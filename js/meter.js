/* =====================================================================
   TOYCOIN — gift tracker (client)
   Standalone on purpose: no GSAP / Lenis dependency, so the numbers keep
   working even if the animation layer fails to load.
   All accounting happens server-side in /api/meter; this file only displays it.
===================================================================== */
(() => {
  "use strict";
  const API = "/api/meter";
  const REFRESH_MS = 60000;
  const TIMEOUT_MS = 12000;
  const $ = (s, c = document) => c.querySelector(s);
  const section = $("#tracker");
  if (!section) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const statusEl = $("#trkStatus");
  const setStatus = (text, cls) => {
    statusEl.className = "tracker__status" + (cls ? " is-" + cls : "");
    $(".tracker__status-text", statusEl).textContent = text;
  };

  /* ---------- formatting (BigInt in, strings out — no floats in the sums) ---------- */
  const usdE6 = (v) => {
    const n = Number(BigInt(v)) / 1e6;
    return "$" + n.toLocaleString("en-US", { minimumFractionDigits: n < 1000 ? 2 : 0, maximumFractionDigits: n < 1000 ? 2 : 0 });
  };
  const sol = (lam) => (Number(BigInt(lam)) / 1e9).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const ago = (iso) => {
    const s = Math.max(1, Math.floor((Date.now() - Date.parse(iso)) / 1000));
    if (s < 90) return s + "s ago"; if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago"; return Math.floor(s / 86400) + "d ago";
  };
  const short = (a) => a.slice(0, 4) + "…" + a.slice(-4);
  const link = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
  const acct = (a) => link("https://solscan.io/account/" + a, short(a));

  /* ---------- count-up (own rAF tween, eased) ---------- */
  const shown = {};
  let inView = false;
  const queued = {};
  function countTo(key, to, fmt) {
    const el = $(`[data-stat="${key}"]`);
    if (!inView || reduce) { shown[key] = to; queued[key] = [to, fmt]; el.textContent = fmt(to); return; }
    const from = shown[key] || 0, dur = from === 0 ? 2200 : 1200, t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step); else shown[key] = to;
    };
    requestAnimationFrame(step);
  }
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !inView) {
      inView = true;
      for (const k in queued) { shown[k] = 0; countTo(k, queued[k][0], queued[k][1]); }
    }
  }, { threshold: 0.2 }).observe(section);

  const money = (v) => "$" + v.toLocaleString("en-US", { minimumFractionDigits: v < 1000 ? 2 : 0, maximumFractionDigits: v < 1000 ? 2 : 0 });
  const sol3 = (v) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const whole = (v) => Math.round(v).toLocaleString("en-US");

  function setMeter(pct) {
    const fill = $("#meterFill"), bow = $("#meterBow");
    fill.style.transition = bow.style.transition = reduce ? "none" : "width 2s cubic-bezier(.2,.8,.2,1), left 2s cubic-bezier(.2,.8,.2,1)";
    fill.style.width = pct + "%"; bow.style.left = pct + "%";
  }

  /* ---------- render ---------- */
  let last = null;
  function render(d) {
    last = d;
    if (!d.configured) {
      setStatus("Waiting for the contract address — the tracker goes live the moment $TOY launches.", null);
      return;
    }
    const s = d.settled, p = d.pending;
    $('[data-meta="mint"]').innerHTML = link("https://solscan.io/token/" + d.mint, short(d.mint));

    // settled (the only thing counted as delivered)
    if (s) {
      countTo("delivered", Number(BigInt(s.netUsdE6)) / 1e6, money);
      countTo("toys", Number(s.toys), whole);
      $('[data-sub="delivered"]').textContent = s.receipts
        ? `${Number(s.receipts).toLocaleString("en-US")} settled donation${s.receipts === 1 ? "" : "s"} · last ${ago(s.lastSettlement.at)}`
        : "first settlement pending";
      $('[data-sub="toys"]').textContent = `at $${s.usdPerToy} per toy`;
      $('[data-meta="receipts"]').innerHTML = s.lastSettlement
        ? `${s.receipts} · ${link("https://solscan.io/tx/" + s.lastSettlement.tx, "last tx")}`
        : String(s.receipts);
      const gross = BigInt(s.grossUsdE6), fee = BigInt(s.feeUsdE6);
      const pct = gross > 0n ? Math.round(Number((fee * 10000n) / gross) / 100) : null;
      $('[data-meta="fees"]').textContent = usdE6(s.feeUsdE6) + (pct !== null ? ` (${pct}%)` : "");

      const list = $("#ledgerList");
      if (s.recent && s.recent.length) {
        list.innerHTML = "";
        s.recent.forEach((r) => {
          const li = document.createElement("li");
          const when = new Date(r.at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
          li.innerHTML = `<span class="gift" aria-hidden="true">🎁</span>${link("https://solscan.io/tx/" + r.tx, when + " · " + short(r.tx))}<b>+${usdE6(r.netUsdE6)}</b>`;
          list.appendChild(li);
        });
      } else {
        list.innerHTML = '<li class="ledger__empty">No settlements yet — rewards are piling up under the tree.</li>';
      }
    } else {
      $('[data-sub="delivered"]').textContent = "settled data unavailable";
    }

    // on its way (shown, never counted)
    if (p) {
      const vaults = BigInt(p.creatorVaultLamports) + BigInt(p.ammVaultLamports);
      const donPending = p.donation ? BigInt(p.donation.pendingLamports) : 0n;
      const sent = p.donation ? BigInt(p.donation.totalDonatedLamports) : 0n;
      countTo("sent", Number(sent) / 1e9, sol3);
      countTo("pending", Number(vaults + donPending) / 1e9, sol3);
      $('[data-sub="sent"]').textContent = p.donation && p.donation.lastCrankAt ? `last hand-off ${ago(p.donation.lastCrankAt)}` : "on-chain total";
      if (p.minted === false) {
        $('[data-sub="sent"]').textContent = "starts at mint";
        $('[data-sub="pending"]').textContent = "starts with the first trade";
      }
      $('[data-meta="sharing"]').innerHTML = acct(p.accounts.sharing) + (p.locked ? " · locked" : "");
      $('[data-meta="donation"]').innerHTML = p.donation ? acct(p.donation.address) : "—";
      $('[data-meta="vaults"]').innerHTML = acct(p.accounts.creatorVault) + " · " + acct(p.accounts.pumpswapVault);

      // ribbon: SOL behind settled receipts vs. every SOL of creator rewards routed or waiting
      const settledSol = s ? BigInt(s.sourceLamports) : 0n;
      const all = sent + donPending + vaults;
      const pct = all > 0n ? Math.min(100, Number((settledSol * 10000n) / all) / 100) : 0;
      countTo("pct", pct, (v) => v.toFixed(1) + "%");
      setMeter(pct);

      const lock = $("#meterLock");
      if (p.locked && p.shareBps) {
        lock.hidden = false;
        lock.textContent = `Locked on-chain: ${Math.round(p.shareBps / 100)}% of creator rewards → donate.gg → Toys for Tots. The split can never be changed.`;
      }
    } else {
      $('[data-sub="pending"]').textContent = "vault balances unavailable";
    }

    const stale = !s || s.stale;
    if (!s) setStatus("Settled data unavailable right now — retrying.", "error");
    else if (stale) setStatus("Showing the last confirmed reading (cached).", "idle");
    else setStatus("Live — settled donations from donate.gg, balances from Solana.", "live");
    updateStamp();
  }

  function updateStamp() {
    if (!last || !last.configured) return;
    const s = last.settled;
    const parts = [];
    if (s && s.fetchedAt) parts.push("settled " + ago(s.fetchedAt));
    if (last.pending && last.pending.fetchedAt) parts.push("chain " + ago(last.pending.fetchedAt));
    $('[data-meta="updated"]').textContent = parts.join(" · ") || "—";
  }
  setInterval(updateStamp, 15000);

  /* ---------- polling ----------
     Every /api/meter call is a CDN request on the hosting bill, so the tracker only asks while its
     section is on (or near) the screen and the tab is visible — visitors who never scroll down to
     it cost nothing, and an open-but-idle tab stops polling. */
  let busy = false, near = false, lastFetch = 0;
  async function load(force) {
    if (busy || document.hidden || !near) return;
    if (!force && Date.now() - lastFetch < REFRESH_MS - 1000) return;
    busy = true;
    lastFetch = Date.now();
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const r = await fetch(API, { signal: ctrl.signal, headers: { Accept: "application/json" } });
      if (!r.ok) throw new Error("HTTP " + r.status);
      render(await r.json());
    } catch (e) {
      if (last && last.configured) setStatus("Showing the last confirmed reading (cached).", "idle");
      else if (!last) setStatus("Tracker unavailable right now — retrying.", "error");
    } finally { clearTimeout(timer); busy = false; }
  }
  new IntersectionObserver(([e]) => {
    near = e.isIntersecting;
    if (near) load();                       // first view, or back after REFRESH_MS
  }, { rootMargin: "600px 0px" }).observe(section);
  setInterval(() => load(), REFRESH_MS);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); });
  addEventListener("online", () => load(true));
})();
