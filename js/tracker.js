/* ------------------------------------------------------------------
   TOYCOIN — on-chain creator-reward tracker
   Reads everything straight from Solana via JSON-RPC, using the account
   layouts in pump.fun's public IDLs (github.com/pump-fun/pump-public-docs).

   For a pump.fun mint it computes:
     pending   – creator rewards accrued but not paid out yet
                 (pump creator vault + PumpSwap creator vault
                  + fees still parked on the bonding curve / pool)
     delivered – creator rewards already paid out to the beneficiary
                 wallet(s) (fee-sharing shareholders, e.g. donate.gg)
     total     – delivered + paid to others + pending
------------------------------------------------------------------- */
(function () {
  const W = window.solanaWeb3;
  if (!W) { console.warn("solanaWeb3 missing – tracker disabled"); return; }
  const { PublicKey } = W;

  const PUMP = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
  const AMM = new PublicKey("pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA");
  const FEES = new PublicKey("pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ");
  const WSOL = new PublicKey("So11111111111111111111111111111111111111112");
  const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
  const ATA_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
  const RENT_EXEMPT_0 = 890880; // rent-exempt minimum of a 0-byte system account
  const LAMPORTS = 1e9;
  const PAYOUT_LOG = /Instruction: (DistributeCreatorFees|CollectCreatorFee|CollectCoinCreatorFee|UpdateFeeShares|TransferCreatorFeesToPump)/;

  const te = new TextEncoder();
  const seed = (s) => te.encode(s);
  const pda = (seeds, program) => PublicKey.findProgramAddressSync(seeds, program)[0];
  const ata = (owner, mint) => pda([owner.toBytes(), TOKEN.toBytes(), mint.toBytes()], ATA_PROGRAM);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const u64 = (d, o) => Number(new DataView(d.buffer, d.byteOffset).getBigUint64(o, true));
  const u32 = (d, o) => new DataView(d.buffer, d.byteOffset).getUint32(o, true);
  const u16 = (d, o) => new DataView(d.buffer, d.byteOffset).getUint16(o, true);

  /* ---------- JSON-RPC with polite retry ---------- */
  let RPC = "https://api.mainnet-beta.solana.com";
  let reqId = 0;
  async function rpc(method, params, tries = 6) {
    let lastErr;
    for (let i = 0; i < tries; i++) {
      try {
        const res = await fetch(RPC, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: ++reqId, method, params }),
        });
        if (res.status === 429 || res.status >= 500) throw new Error("rate limited (" + res.status + ")");
        const j = await res.json();
        if (j.error) {
          if (j.error.code === 429 || /rate|too many/i.test(j.error.message)) throw new Error(j.error.message);
          const e = new Error(j.error.message); e.fatal = true; throw e;
        }
        return j.result;
      } catch (e) {
        lastErr = e;
        if (e.fatal) throw e;
        await sleep(500 * 2 ** i + Math.random() * 300);
      }
    }
    throw lastErr || new Error("RPC unavailable");
  }

  // JSON-RPC batch (one HTTP round trip for many calls). Falls back to
  // single calls if the provider doesn't support batching.
  let batchOk = true;
  async function rpcBatch(method, paramsList) {
    if (batchOk && paramsList.length > 1) {
      for (let i = 0; i < 5; i++) {
        try {
          const res = await fetch(RPC, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(paramsList.map((params, k) => ({ jsonrpc: "2.0", id: k, method, params }))),
          });
          if (res.status === 429 || res.status >= 500) { await sleep(600 * 2 ** i); continue; }
          const j = await res.json();
          if (!Array.isArray(j)) { batchOk = false; break; }
          const out = new Array(paramsList.length);
          const retry = [];
          j.forEach((r) => { if (r.error) retry.push(r.id); else out[r.id] = r.result; });
          for (const k of retry) out[k] = await rpc(method, paramsList[k]);
          return out;
        } catch (e) { await sleep(600 * 2 ** i); }
      }
      batchOk = false;
    }
    const out = [];
    for (const p of paramsList) out.push(await rpc(method, p));
    return out;
  }

  async function getAccounts(keys) {
    const r = await rpc("getMultipleAccounts", [keys.map((k) => k.toBase58()), { encoding: "base64", commitment: "confirmed" }]);
    return r.value.map((a) => a && { lamports: a.lamports, owner: a.owner, data: b64(a.data[0]) });
  }

  /* ---------- local cache (per mint) ---------- */
  const cacheKey = (mint) => "toy-tracker-v1:" + mint;
  function loadCache(mint) {
    try { return JSON.parse(localStorage.getItem(cacheKey(mint))) || null; } catch { return null; }
  }
  function saveCache(mint, c) {
    try { localStorage.setItem(cacheKey(mint), JSON.stringify(c)); } catch { /* storage unavailable */ }
  }

  /* ---------- read the current state of the coin ---------- */
  async function readState(mint) {
    const mb = mint.toBytes();
    const bondingCurve = pda([seed("bonding-curve"), mb], PUMP);
    const sharingConfig = pda([seed("sharing-config"), mb], FEES);
    const poolAuthority = pda([seed("pool-authority"), mb], PUMP);
    const pool = pda([seed("pool"), new Uint8Array([0, 0]), poolAuthority.toBytes(), mb, WSOL.toBytes()], AMM);

    const [bc, sh, pl] = await getAccounts([bondingCurve, sharingConfig, pool]);
    if (!bc || bc.owner !== PUMP.toBase58()) throw new Error("This mint has no pump.fun bonding curve.");

    // BondingCurve: disc(8) vtr vqr rtr rqr supply(5×u64) complete(48) creator(49..81)
    //   mayhem(81) cashback(82) quote_mint(83..115) creator_fee_bps(115) can_edit(123)
    //   holder_reward(124) creator_fee(125..133) protocol_fees(133..141)
    const d = bc.data;
    const complete = d[48] === 1;
    const creator = new PublicKey(d.slice(49, 81));
    let quote = WSOL;
    if (d.length >= 115 && d.slice(83, 115).some((b) => b)) quote = new PublicKey(d.slice(83, 115));
    const curvePending = d.length >= 133 ? u64(d, 125) : 0;

    // PumpSwap pool (after graduation): coin_creator(211..243) ... creator_fees(279..287)
    let coinCreator = creator, poolPending = 0, graduated = false;
    if (pl && pl.owner === AMM.toBase58()) {
      graduated = true;
      coinCreator = new PublicKey(pl.data.slice(211, 243));
      if (pl.data.length >= 287) poolPending = u64(pl.data, 279);
    }

    // SharingConfig: disc(8) bump version status(10) mint(11..43) admin(43..75) revoked(75) vec<len u32 @76>{pubkey,u16}
    let shareholders = [], sharingStatus = null;
    if (sh && sh.owner === FEES.toBase58()) {
      const s = sh.data;
      sharingStatus = s[10] === 1 ? "active" : "paused";
      const n = u32(s, 76);
      for (let i = 0; i < n && 80 + i * 34 + 34 <= s.length; i++) {
        const o = 80 + i * 34;
        shareholders.push({ address: new PublicKey(s.slice(o, o + 32)).toBase58(), bps: u16(s, o + 32) });
      }
    }
    const usesSharing = creator.equals(sharingConfig);

    const creatorVault = pda([seed("creator-vault"), creator.toBytes()], PUMP);
    const ammVaultAuthority = pda([seed("creator_vault"), coinCreator.toBytes()], AMM);
    const ammVault = ata(ammVaultAuthority, quote);
    const [cv, av] = await getAccounts([creatorVault, ammVault]);

    const vaultPending = cv ? Math.max(0, cv.lamports - RENT_EXEMPT_0) : 0;
    const ammPending = av && av.data.length >= 72 ? u64(av.data, 64) : 0; // SPL token amount @64

    return {
      mint: mint.toBase58(), complete, graduated,
      isSolPaired: quote.equals(WSOL),
      creator: creator.toBase58(), coinCreator: coinCreator.toBase58(),
      usesSharing, sharingConfig: sharingConfig.toBase58(), sharingStatus, shareholders,
      creatorVault: creatorVault.toBase58(), ammVault: ammVault.toBase58(),
      pending: { vault: vaultPending, amm: ammPending, curve: curvePending, pool: poolPending },
    };
  }

  /* ---------- scan payout history ---------- */
  async function scanPayouts(state, beneficiaries, opts, onProgress) {
    // Every payout drains the pump creator vault (fee-sharing distributions,
    // creator claims, and AMM fees transferred over first). The vault only sees
    // sweeps and payouts, so its history stays small — unlike the sharing
    // config or the AMM vault, which are touched by every single trade.
    // Plain-creator coins can also claim AMM fees directly from the AMM vault,
    // so that one is scanned too (capped).
    const sources = state.usesSharing ? [state.creatorVault] : [state.creatorVault, state.ammVault];
    const recipients = state.usesSharing
      ? state.shareholders.map((s) => s.address)
      : [...new Set([state.creator, state.coinCreator])];
    const benef = new Set(beneficiaries && beneficiaries.length ? beneficiaries : recipients);

    const cache = loadCache(state.mint) || { newest: {}, seen: {}, events: [], delivered: 0, other: 0, partial: false };
    let fetched = 0, total = 0;
    const snapshot = () => cache;
    onProgress && onProgress(0, 0, snapshot());

    for (const src of sources) {
      const sigs = [];
      let before;
      while (sigs.length < opts.maxHistoryTx) {
        const params = { limit: Math.min(1000, opts.maxHistoryTx - sigs.length) };
        if (before) params.before = before;
        if (cache.newest[src]) params.until = cache.newest[src];
        const page = await rpc("getSignaturesForAddress", [src, params]);
        sigs.push(...page);
        if (page.length < params.limit) break;
        before = page[page.length - 1].signature;
      }
      if (sigs.length >= opts.maxHistoryTx) cache.partial = true;
      const todo = sigs.filter((s) => !s.err && !cache.seen[s.signature]);
      total += todo.length;

      const CHUNK = 20;
      let i = 0;
      const worker = async () => {
        while (i < todo.length) {
          const chunk = todo.slice(i, (i += CHUNK));
          const txs = await rpcBatch("getTransaction", chunk.map((s) => [s.signature, { encoding: "json", maxSupportedTransactionVersion: 0, commitment: "confirmed" }]));
          chunk.forEach((s, k) => handle(s, txs[k]));
          fetched += chunk.length;
          saveCache(state.mint, cache);
          onProgress && onProgress(fetched, total, snapshot());
        }
      };
      const handle = (s, tx) => {
        {
          cache.seen[s.signature] = 1;
          if (!tx || !tx.meta || tx.meta.err) return;
          if (!(tx.meta.logMessages || []).some((l) => PAYOUT_LOG.test(l))) return;
          const keys = tx.transaction.message.accountKeys.concat(
            tx.meta.loadedAddresses ? tx.meta.loadedAddresses.writable.concat(tx.meta.loadedAddresses.readonly) : []
          );
          let toBenef = 0, toOther = 0;
          for (const r of recipients) {
            const idx = keys.indexOf(r);
            if (idx < 0) continue;
            let gain = tx.meta.postBalances[idx] - tx.meta.preBalances[idx];
            if (idx === 0) gain += tx.meta.fee; // recipient paid the network fee itself
            // wSOL payouts to a recipient token account
            for (const pb of tx.meta.postTokenBalances || []) {
              if (pb.owner !== r || pb.mint !== WSOL.toBase58()) continue;
              const pre = (tx.meta.preTokenBalances || []).find((x) => x.accountIndex === pb.accountIndex);
              gain += Number(pb.uiTokenAmount.amount) - (pre ? Number(pre.uiTokenAmount.amount) : 0);
            }
            if (gain <= 0) continue;
            if (benef.has(r)) toBenef += gain; else toOther += gain;
          }
          if (toBenef + toOther > 0) {
            cache.delivered += toBenef;
            cache.other += toOther;
            cache.events.push({ sig: s.signature, t: tx.blockTime || s.blockTime, amt: toBenef, other: toOther });
            cache.events.sort((a, b) => (b.t || 0) - (a.t || 0));
            if (cache.events.length > 50) cache.events.length = 50;
          }
        }
      };
      await Promise.all([worker(), worker()]);
      if (sigs.length) cache.newest[src] = sigs[0].signature;
    }
    saveCache(state.mint, cache);
    return cache;
  }

  async function solPrice() {
    try {
      const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
      const j = await r.json();
      if (j.solana && j.solana.usd) return j.solana.usd;
    } catch { /* try next */ }
    try {
      const r = await fetch("https://lite-api.jup.ag/price/v3?ids=" + WSOL.toBase58());
      const j = await r.json();
      const p = j[WSOL.toBase58()];
      if (p && p.usdPrice) return p.usdPrice;
    } catch { /* give up */ }
    return null;
  }

  /**
   * analyze(mint, opts, onUpdate)
   *   onUpdate(result, progress) fires right after the live state is read
   *   (using cached history), after every scanned batch, and is also the
   *   resolved value at the end — so the UI can render immediately.
   */
  async function analyze(mintStr, opts = {}, onUpdate) {
    RPC = opts.rpc || RPC;
    const mint = new PublicKey(mintStr.trim());
    const [state, price] = await Promise.all([readState(mint), solPrice()]);
    const p = state.pending;
    const pending = p.vault + p.amm + p.curve + p.pool;
    const build = (hist, progress) => ({
      state, price,
      sol: {
        total: (hist.delivered + hist.other + pending) / LAMPORTS,
        delivered: hist.delivered / LAMPORTS,
        pending: pending / LAMPORTS,
        other: hist.other / LAMPORTS,
      },
      events: hist.events.slice(0, 12).map((e) => ({ ...e, amt: e.amt / LAMPORTS })),
      partial: hist.partial,
      progress,
      updated: Date.now(),
    });
    let historyError = null, hist;
    try {
      hist = await scanPayouts(state, opts.beneficiaries, { maxHistoryTx: opts.maxHistoryTx || 1500 },
        (done, total, h) => onUpdate && onUpdate(build(h, { done, total })));
    } catch (e) {
      historyError = e;
      hist = loadCache(state.mint) || { delivered: 0, other: 0, events: [], partial: true };
    }
    const result = build(hist, null);
    result.historyError = historyError && (historyError.message || String(historyError));
    return result;
  }

  window.ToyTracker = { analyze };
})();
