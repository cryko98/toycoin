'use strict';
/*
 * GET /api/meter — one shared, cached reading for every visitor.
 *
 *  settled  : donate.gg receipts settled to Toys for Tots for $TOY   -> the ONLY input to "delivered" / toys
 *  pending  : creator vaults + donation account balances on Solana  -> shown as "on its way", never counted
 *
 * Failures are isolated: if the chain is down the settled total still publishes, and vice versa.
 * A refresh that is partial, inconsistent, or would rewrite already-counted history is rejected and the
 * last good reading stays published (marked stale once it ages).
 * Settings: api/_lib/config.js (all overridable with env vars, see there).
 */
const core = require('./_lib/meter-core');
const snapshot = require('./_data/settled-snapshot.json');

const SETTLED_TTL = 60 * 1000;   // re-read receipts at most once a minute per instance
const CHAIN_TTL = 20 * 1000;
const STALE_AFTER = 5 * 60 * 1000;
const MINT = core.EXPECTED.mint;

const RPC_URLS = (process.env.SOLANA_RPC_URLS || 'https://api.mainnet-beta.solana.com,https://solana-rpc.publicnode.com')
  .split(',').map(s => s.trim()).filter(Boolean);
const rpc = core.makeRpc(fetch, RPC_URLS);

// committed history starts from the bundled, validated public snapshot
const state = {
  committed: core.ledgerFromJson(snapshot.receipts),
  settled: null, settledAt: 0, settledSource: 'snapshot', settledError: null,
  chain: null, chainAt: 0, chainError: null, lastSlot: 0,
  inflight: null, backoffUntil: 0, failures: 0
};
state.settled = core.summarize(state.committed);
state.settledAt = Date.parse(snapshot.generatedAt) || 0;

// Which donate.gg config(s) may $TOY receipts use? A pinned id wins; otherwise the config id stored in
// the coin's own Pump Fees donation account (read from the chain). Unknown → attribution by mint only.
function allowedConfigIds() {
  if (core.EXPECTED.configId) return new Set([core.EXPECTED.configId]);
  if (state.chain && state.chain.configIds && state.chain.configIds.length) return new Set(state.chain.configIds.map(s => s.toLowerCase()));
  return null;
}

async function refreshSettled() {
  try {
    const receipts = await core.fetchAllReceipts(fetch, { apiKey: process.env.DONATE_API_KEY });
    const { ledger } = core.buildLedger(receipts, { committed: state.committed, configIds: allowedConfigIds() });
    // "persist" before publishing: the new ledger becomes the committed history for this instance
    state.committed = ledger;
    state.settled = core.summarize(ledger);
    state.settledAt = Date.now();
    state.settledSource = 'live';
    state.settledError = null;
    return true;
  } catch (e) {
    state.settledError = e instanceof core.RefreshRejected ? 'rejected' : 'unavailable';
    console.error('[meter] settled refresh failed:', e.message);
    return false;
  }
}

async function refreshChain() {
  try {
    const c = await core.readChain(rpc, { minContextSlot: state.lastSlot });
    if (c.slot < state.lastSlot) throw new Error('older snapshot');
    state.lastSlot = c.slot;
    state.chain = c;
    state.chainAt = Date.now();
    state.chainError = null;
    return true;
  } catch (e) {
    state.chainError = 'unavailable';
    console.error('[meter] chain refresh failed:', String(e.message).replace(/https?:\/\/\S+/g, '[redacted]'));
    return false;
  }
}

async function refresh() {
  if (!MINT) return;                                     // pre-launch: nothing to read yet
  if (state.inflight) return state.inflight;            // concurrent requests share one refresh
  if (Date.now() < state.backoffUntil) return;
  const now = Date.now();
  const wantChain = now - state.chainAt > CHAIN_TTL;
  const wantSettled = now - state.settledAt > SETTLED_TTL || state.settledSource === 'snapshot';
  if (!wantChain && !wantSettled) return;
  state.inflight = (async () => {
    const results = [];
    // chain first: it tells us which donate.gg config the receipts must carry
    if (wantChain) results.push(await refreshChain());
    if (wantSettled) results.push(await refreshSettled());
    const ok = results.every(Boolean);
    state.failures = ok ? 0 : Math.min(state.failures + 1, 6);
    state.backoffUntil = ok ? 0 : Date.now() + 2 ** state.failures * 1000;
  })().finally(() => { state.inflight = null; });
  return state.inflight;
}

function payload() {
  const now = Date.now();
  if (!MINT) {
    return { version: 1, configured: false, mint: null, charity: core.EXPECTED.charityName, generatedAt: new Date(now).toISOString(), settled: null, pending: null, errors: {} };
  }
  return {
    version: 1,
    configured: true,
    mint: MINT,
    charity: core.EXPECTED.charityName,
    generatedAt: new Date(now).toISOString(),
    settled: state.settled && {
      ...state.settled,
      fetchedAt: state.settledAt ? new Date(state.settledAt).toISOString() : null,
      source: state.settledSource,
      stale: now - state.settledAt > STALE_AFTER,
      error: state.settledError
    },
    pending: state.chain && {
      ...state.chain,
      fetchedAt: new Date(state.chainAt).toISOString(),
      stale: now - state.chainAt > STALE_AFTER,
      error: state.chainError
    },
    errors: { settled: state.settledError, chain: state.chain ? state.chainError : (state.chainError || 'unavailable') }
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405; res.setHeader('Allow', 'GET, HEAD'); return res.end();
  }
  try { await refresh(); } catch (e) { console.error('[meter] refresh crashed:', e.message); }
  const body = JSON.stringify(payload());
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=60, stale-while-revalidate=300');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(req.method === 'HEAD' ? undefined : body);
};
module.exports._state = state; // for tests
