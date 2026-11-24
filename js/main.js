/* =====================================================================
   TOYCOIN — interactions, motion & tracker UI
===================================================================== */
(() => {
  const CFG = window.TOY_CONFIG || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGsap = !!window.gsap;
  if (hasGsap && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  /* ---------- links + CA ---------- */
  const links = Object.assign({}, CFG.links);
  if (CFG.mint) links.pump = "https://pump.fun/coin/" + CFG.mint;
  $$("[data-link]").forEach((a) => {
    const url = links[a.dataset.link];
    if (url) a.href = url;
  });
  if (CFG.mint) $$("[data-ca]").forEach((el) => (el.textContent = CFG.mint));

  const toast = (msg) => {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("is-on");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove("is-on"), 2200);
  };
  $("#caPill").addEventListener("click", async () => {
    if (!CFG.mint) return toast("🎁 The contract address drops at launch.");
    try { await navigator.clipboard.writeText(CFG.mint); toast("Contract address copied ✓"); }
    catch { toast(CFG.mint); }
  });

  /* ---------- nav ---------- */
  const nav = $("#nav"), burger = $(".nav__burger"), drawer = $("#drawer");
  let lastY = 0;
  const onScroll = (y) => {
    nav.classList.toggle("is-solid", y > window.innerHeight * 0.6);
    nav.classList.toggle("is-hidden", y > 600 && y > lastY && drawer.hidden);
    lastY = y;
  };
  burger.addEventListener("click", () => {
    const open = drawer.hidden;
    drawer.hidden = !open;
    burger.setAttribute("aria-expanded", String(open));
    nav.classList.add("is-solid");
  });
  drawer.addEventListener("click", (e) => {
    if (e.target.tagName === "A") { drawer.hidden = true; burger.setAttribute("aria-expanded", "false"); }
  });

  /* ---------- smooth scroll ---------- */
  let lenis = null;
  if (window.Lenis && !reduce) {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on("scroll", (e) => { onScroll(e.scroll); window.__scrollVelocity = e.velocity; if (window.ScrollTrigger) ScrollTrigger.update(); });
    if (hasGsap) { gsap.ticker.add((t) => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0); }
    else { const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); }; requestAnimationFrame(raf); }
  } else {
    addEventListener("scroll", () => onScroll(scrollY), { passive: true });
  }
  $$('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    if (id.length < 2) return;
    const el = $(id);
    if (!el) return;
    e.preventDefault();
    lenis ? lenis.scrollTo(el, { offset: id === "#top" ? 0 : -20, duration: 1.4 }) : el.scrollIntoView({ behavior: "smooth" });
  }));

  /* ---------- split headings into words ---------- */
  $$(".split").forEach((el) => {
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
            const w = document.createElement("span"); w.className = "w";
            const i = document.createElement("span"); i.textContent = part;
            w.appendChild(i); frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== "BR") walk(n);
      });
    };
    walk(el);
  });

  /* ---------- snow ---------- */
  $$("canvas.snow").forEach((cv) => {
    const ctx = cv.getContext("2d");
    const density = parseFloat(cv.dataset.density || "1");
    let w, h, flakes = [], visible = true, dpr = Math.min(devicePixelRatio || 1, 2);
    const resize = () => {
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round((w * h) / 9000 * density);
      flakes = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        r: Math.random() * 2.4 + 0.6, s: Math.random() * 0.6 + 0.25,
        d: Math.random() * Math.PI * 2, o: Math.random() * 0.6 + 0.25,
      }));
    };
    resize(); addEventListener("resize", resize);
    new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(cv);
    let mx = 0;
    addEventListener("pointermove", (e) => (mx = (e.clientX / innerWidth - 0.5) * 0.8), { passive: true });
    const tick = (t) => {
      if (visible) {
        ctx.clearRect(0, 0, w, h);
        for (const f of flakes) {
          f.y += f.s * (reduce ? 0.3 : 1);
          f.x += Math.sin(t / 1600 + f.d) * 0.35 + mx * f.r * 0.4;
          if (f.y > h + 5) { f.y = -5; f.x = Math.random() * w; }
          if (f.x > w + 5) f.x = -5; if (f.x < -5) f.x = w + 5;
          ctx.globalAlpha = f.o;
          ctx.fillStyle = "#FFF4E3";
          ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  /* ---------- marquee (scroll-velocity reactive) ---------- */
  const track = $(".marquee__track");
  if (track) {
    let x = 0, speed = 0.6, dir = -1;
    const loop = () => {
      const v = window.__scrollVelocity || 0;
      if (Math.abs(v) > 0.2) dir = v > 0 ? -1 : 1;
      x += dir * (speed + Math.min(Math.abs(v) * 0.35, 14));
      const half = track.scrollWidth / 2;
      if (x <= -half) x += half; if (x > 0) x -= half;
      track.style.transform = `translate3d(${x}px,0,0)`;
      window.__scrollVelocity = (window.__scrollVelocity || 0) * 0.9;
      requestAnimationFrame(loop);
    };
    if (!reduce) requestAnimationFrame(loop);
  }

  /* ---------- magnetic buttons ---------- */
  if (!reduce && matchMedia("(pointer: fine)").matches) {
    $$(".magnetic").forEach((b) => {
      b.addEventListener("pointermove", (e) => {
        const r = b.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        b.style.transform = `translate(${dx * 0.18}px, ${dy * 0.28}px)`;
      });
      b.addEventListener("pointerleave", () => { b.style.transition = "transform .5s cubic-bezier(.2,.8,.2,1)"; b.style.transform = ""; setTimeout(() => (b.style.transition = ""), 500); });
    });
  }

  /* ---------- GSAP choreography ---------- */
  if (hasGsap && !reduce) {
    // Intro
    const intro = gsap.timeline({ defaults: { ease: "expo.out" } });
    intro
      .from(".nav", { y: -30, opacity: 0, duration: 1 }, 0.1)
      .from(".eyebrow", { y: 20, opacity: 0, duration: 1 }, 0.2)
      .from(".hero__title .w > span", { yPercent: 110, rotate: 4, duration: 1.3, stagger: 0.06 }, 0.25)
      .from(".hero__lede, .hero__ctas, .ca", { y: 26, opacity: 0, duration: 1.1, stagger: 0.08 }, 0.6)
      .from("#coinWrap", { scale: 0.6, opacity: 0, duration: 1.8, ease: "elastic.out(1, .6)" }, 0.35)
      .from(".block", { y: -340, opacity: 0, duration: 1.1, stagger: 0.12, ease: "bounce.out" }, 0.8)
      .from(".hero__scroll", { opacity: 0, duration: 1 }, 1.4);

    // Hero parallax out
    gsap.to(".hero__copy", { yPercent: -18, opacity: 0.2, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
    gsap.to(".blocks", { y: 120, rotate: 8, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });

    // Section headings
    $$(".split").forEach((el) => {
      if (el.closest(".hero")) return;
      gsap.from(el.querySelectorAll(".w > span"), {
        yPercent: 115, rotate: 3, duration: 1.2, ease: "expo.out", stagger: 0.05,
        scrollTrigger: { trigger: el, start: "top 85%" },
      });
    });
    $$(".kicker, .section-sub").forEach((el) => gsap.from(el, { y: 20, opacity: 0, duration: 1, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 90%" } }));

    // Tracker cards
    gsap.from(".stat, .ribbon-meter, .ledger__col, .tracker__status", {
      y: 60, opacity: 0, duration: 1.1, ease: "expo.out", stagger: 0.08,
      scrollTrigger: { trigger: ".stats", start: "top 85%" },
    });

    // How-it-works ribbon + steps
    const rib = $("#howRibbon");
    if (rib) {
      rib.setAttribute("pathLength", "1");
      gsap.to(rib, { strokeDashoffset: 0, ease: "none", scrollTrigger: { trigger: ".how__track", start: "top 75%", end: "bottom 60%", scrub: 1 } });
    }
    gsap.from(".step", { y: 80, opacity: 0, rotate: (i) => (i % 2 ? 3 : -3), duration: 1.2, ease: "expo.out", stagger: 0.12, scrollTrigger: { trigger: ".steps", start: "top 80%" } });

    // Charity toy box — float in + parallax
    $$(".toy").forEach((t, i) => {
      gsap.from(t, { scale: 0, rotate: (i % 2 ? 30 : -30), opacity: 0, duration: 1.3, ease: "back.out(1.6)", delay: i * 0.07, scrollTrigger: { trigger: ".toybox", start: "top 80%" } });
      gsap.to(t, { y: (i % 3 - 1) * 70, rotate: (i % 2 ? 8 : -8), ease: "none", scrollTrigger: { trigger: ".charity", start: "top bottom", end: "bottom top", scrub: true } });
      gsap.to(t, { y: "+=12", duration: 2.4 + i * 0.3, repeat: -1, yoyo: true, ease: "sine.inOut", delay: 1.5 });
    });

    // Gift tags swing in on their strings
    gsap.from(".tag", { rotateX: -80, rotate: (i) => (i % 2 ? 12 : -12), opacity: 0, transformOrigin: "50% -30px", duration: 1.6, ease: "elastic.out(1, .45)", stagger: 0.09, scrollTrigger: { trigger: ".tags", start: "top 80%" } });

    // Advent doors
    gsap.from(".door", { rotateY: -90, transformOrigin: "left center", opacity: 0, duration: 1.2, ease: "expo.out", stagger: 0.1, scrollTrigger: { trigger: ".doors", start: "top 85%" } });

    // FAQ + footer
    gsap.from(".faq__list details", { y: 30, opacity: 0, duration: 0.9, ease: "expo.out", stagger: 0.07, scrollTrigger: { trigger: ".faq__list", start: "top 85%" } });
    gsap.from(".footer__word", { yPercent: 60, opacity: 0, duration: 1.4, ease: "expo.out", scrollTrigger: { trigger: ".footer", start: "top 90%" } });
  } else {
    $("#howRibbon") && $("#howRibbon").setAttribute("pathLength", "1");
    $("#howRibbon") && ($("#howRibbon").style.strokeDashoffset = 0);
  }

  /* ---------- countdown ---------- */
  const target = new Date(CFG.christmas || "2026-12-25T00:00:00").getTime();
  const cd = { d: $('[data-cd="d"]'), h: $('[data-cd="h"]'), m: $('[data-cd="m"]'), s: $('[data-cd="s"]') };
  const pad = (n) => String(n).padStart(2, "0");
  const tickCd = () => {
    let diff = Math.max(0, target - Date.now());
    const d = Math.floor(diff / 864e5); diff -= d * 864e5;
    const h = Math.floor(diff / 36e5); diff -= h * 36e5;
    const m = Math.floor(diff / 6e4); diff -= m * 6e4;
    const s = Math.floor(diff / 1e3);
    const set = (el, v) => {
      if (el.textContent === v) return;
      el.textContent = v;
      if (hasGsap && !reduce) gsap.fromTo(el, { yPercent: -30, opacity: 0.2 }, { yPercent: 0, opacity: 1, duration: 0.45, ease: "back.out(2)" });
    };
    set(cd.d, pad(d)); set(cd.h, pad(h)); set(cd.m, pad(m)); set(cd.s, pad(s));
    if (target <= Date.now()) $(".countdown .kicker").textContent = "Merry Christmas — it’s here";
  };
  tickCd(); setInterval(tickCd, 1000);

  /* =====================================================================
     TRACKER UI
  ===================================================================== */
  const statusEl = $("#trkStatus");
  const setStatus = (text, cls) => {
    statusEl.className = "tracker__status" + (cls ? " is-" + cls : "");
    $(".tracker__status-text", statusEl).textContent = text;
  };
  const short = (a) => a.slice(0, 4) + "…" + a.slice(-4);
  const solscan = (a, type = "account") => `https://solscan.io/${type}/${a}`;
  const fmtSol = (v) => v >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 1 }) : v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const fmtUsd = (v) => "≈ $" + v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  const current = { total: 0, delivered: 0, pending: 0, toys: 0, pct: 0 };

  function animateTo(key, to, fmt) {
    const el = $(`[data-stat="${key}"]`);
    const obj = { v: current[key] };
    current[key] = to;
    if (!hasGsap || reduce) { el.textContent = fmt(to); return; }
    gsap.to(obj, { v: to, duration: 2.2, ease: "expo.out", onUpdate: () => (el.textContent = fmt(obj.v)) });
  }

  function render(r, mint) {
    const { sol, price, state } = r;
    animateTo("total", sol.total, fmtSol);
    animateTo("delivered", sol.delivered, fmtSol);
    animateTo("pending", sol.pending, fmtSol);
    const usd = (k) => (price ? fmtUsd(sol[k] * price) : "USD price unavailable");
    $('[data-usd="total"]').textContent = usd("total");
    $('[data-usd="delivered"]').textContent = usd("delivered");
    $('[data-usd="pending"]').textContent = usd("pending");
    const toys = price ? Math.floor((sol.delivered * price) / (CFG.usdPerToy || 25)) : 0;
    animateTo("toys", toys, (v) => Math.round(v).toLocaleString("en-US"));
    const pct = sol.total > 0 ? (sol.delivered / sol.total) * 100 : 0;
    animateTo("pct", pct, (v) => v.toFixed(1) + "%");
    if (hasGsap && !reduce) {
      gsap.to("#meterFill", { width: pct + "%", duration: 2.2, ease: "expo.out" });
      gsap.to("#meterBow", { left: pct + "%", duration: 2.2, ease: "expo.out" });
    } else { $("#meterFill").style.width = pct + "%"; $("#meterBow").style.left = pct + "%"; }

    const list = $("#ledgerList");
    list.innerHTML = "";
    if (!r.events.length) {
      list.innerHTML = '<li class="ledger__empty">No deliveries yet — rewards are piling up under the tree.</li>';
    } else {
      r.events.forEach((e) => {
        const li = document.createElement("li");
        const when = e.t ? new Date(e.t * 1000).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
        li.innerHTML = `<span class="gift">🎁</span><a href="${solscan(e.sig, "tx")}" target="_blank" rel="noopener">${when} · ${short(e.sig)}</a><b>+${fmtSol(e.amt)} SOL</b>`;
        list.appendChild(li);
      });
    }

    const link = (a) => `<a href="${solscan(a)}" target="_blank" rel="noopener">${short(a)}</a>`;
    $('[data-meta="mint"]').innerHTML = `<a href="${solscan(mint, "token")}" target="_blank" rel="noopener">${short(mint)}</a>`;
    $('[data-meta="vault"]').innerHTML = link(state.creatorVault);
    $('[data-meta="sharing"]').innerHTML = state.usesSharing ? link(state.sharingConfig) + (state.sharingStatus ? ` · ${state.sharingStatus}` : "") : "not used";
    $('[data-meta="holders"]').innerHTML = state.usesSharing && state.shareholders.length
      ? state.shareholders.map((s) => `${link(s.address)} ${(s.bps / 100).toFixed(0)}%`).join("<br>")
      : link(state.creator) + " (creator)";
    $('[data-meta="stage"]').textContent = state.graduated ? "Graduated · PumpSwap" : state.complete ? "Bonding curve complete" : "Bonding curve";
    $('[data-meta="updated"]').textContent = new Date(r.updated).toLocaleTimeString();
  }

  // Public fallback: reads live balances fine, but has no transaction-history
  // index — set a Helius/QuickNode URL in config.js for the delivered total.
  const FALLBACK_RPC = "https://solana-rpc.publicnode.com";
  const rpcUrl = CFG.rpc || FALLBACK_RPC;

  let running = false, timer = null, lastRender = 0;
  async function run(mint, { silent } = {}) {
    if (!window.ToyTracker || running) return;
    running = true;
    if (!silent) setStatus("Reading Solana mainnet…", "loading");
    try {
      const r = await window.ToyTracker.analyze(mint, {
        rpc: rpcUrl, maxHistoryTx: CFG.maxHistoryTx, beneficiaries: CFG.beneficiaries,
      }, (partial) => {
        const now = Date.now();
        if (now - lastRender > 900) { lastRender = now; render(partial, mint); }
        const pr = partial.progress;
        if (!silent && pr && pr.total) setStatus(`Counting past deliveries… ${pr.done}/${pr.total} transactions`, "loading");
      });
      render(r, mint);
      const who = mint === CFG.mint ? "Live — " : "Showing " + short(mint) + " — ";
      if (r.historyError) setStatus(who + "live balances loaded, but this RPC couldn’t return payout history (" + r.historyError + ").", "error");
      else setStatus(who + "numbers read directly from Solana" + (r.partial ? " (history capped — delivered total may be partial)" : "") + (rpcUrl === FALLBACK_RPC ? " · history needs a full RPC" : "") + ".", "live");
    } catch (e) {
      console.error(e);
      setStatus("Couldn’t read the chain: " + (e.message || e) + " — retrying shortly.", "error");
    } finally { running = false; }
  }

  if (CFG.mint) {
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        io.disconnect();
        run(CFG.mint);
        timer = setInterval(() => run(CFG.mint, { silent: true }), CFG.refreshMs || 60000);
      }
    }, { rootMargin: "400px" });
    io.observe($("#tracker"));
  }

  $("#inspectForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = $("#inspectInput").value.trim();
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v)) return toast("That doesn’t look like a Solana address.");
    clearInterval(timer);
    run(v);
  });
})();
