/* =====================================================================
   TOYCOIN — scroll-driven gift journey
   trade → creator reward coin → donate.gg turns it into $ → Toys for Tots
   turns the money into a wrapped teddy bear → delivered → a kid's Christmas.
   The scene is pinned and scrubbed by scroll (forwards and backwards).
===================================================================== */
(() => {
  const svg = document.getElementById("journeySvg");
  const pinEl = document.getElementById("journeyPin");
  if (!svg || !pinEl || !window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  const $ = (s) => svg.querySelector(s);
  const CFG = window.TOY_CONFIG || {};
  const TOY_PRICE = CFG.usdPerToy || 25;
  const caption = document.getElementById("journeyCaption");
  const progressBar = document.getElementById("journeyProgress");
  const steps = [...document.querySelectorAll("#jsteps li")];
  const fx = $("#jFx");
  const fundAmt = $("#jFundAmt");
  const scroller = document.getElementById("stageScroller");
  const NS = "http://www.w3.org/2000/svg";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const CAPTIONS = [
    "Someone trades <b>$TOY</b> on pump.fun — the trade pays a small <b>creator reward</b>, a coin of SOL.",
    "The coins go to <b>donate.gg</b>, which converts the SOL into <b>dollars</b> and sends them to Toys for Tots.",
    "Toys for Tots turns the money into a brand-new <b>teddy bear</b> — and volunteers wrap it into a gift.",
    "The wrapped gift rides the delivery van across town to a family that needs it.",
    "Christmas morning: a kid finds it under the tree. <b>That’s what every $TOY trade does.</b>",
  ];
  const CAMERA = [140, 330, 560, 860, 1060]; // svg x the mobile "camera" centres on per step

  /* ---------- ambient: snow + twinkling lights (time-based, not scrubbed) ---------- */
  const snow = $("#jSnow");
  for (let i = 0; i < 34; i++) {
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("r", (Math.random() * 2.6 + 1).toFixed(1));
    c.setAttribute("fill", i % 5 ? "#E8D9BF" : "#D9A441");
    snow.appendChild(c);
    const x = Math.random() * 1200;
    gsap.set(c, { x, y: Math.random() * 460 });
    if (!reduce) gsap.to(c, { y: 470, x: x + (Math.random() * 80 - 40), duration: 6 + Math.random() * 6, repeat: -1, ease: "none", delay: -Math.random() * 10 });
  }
  if (!reduce) {
    svg.querySelectorAll("#jLights circle, #jOrnaments circle").forEach((l, i) =>
      gsap.to(l, { opacity: 0.35, duration: 0.6 + (i % 3) * 0.25, repeat: -1, yoyo: true, ease: "sine.inOut", delay: i * 0.13 }));
  }

  /* ---------- one-shot effects (only when scrolling forwards) ---------- */
  let forward = true;
  function burst(x, y, n = 30) {
    if (!forward) return;
    const colors = ["#B3262E", "#D9A441", "#1F5A3D", "#FFF4E3", "#F2C66B"];
    for (let i = 0; i < n; i++) {
      const r = document.createElementNS(NS, i % 3 ? "rect" : "circle");
      if (r.tagName === "rect") { r.setAttribute("width", 7); r.setAttribute("height", 12); r.setAttribute("rx", 2); }
      else r.setAttribute("r", 3.5);
      r.setAttribute("fill", colors[i % colors.length]);
      fx.appendChild(r);
      const a = Math.random() * Math.PI * 2, d = 50 + Math.random() * 100;
      gsap.set(r, { x, y, rotation: Math.random() * 360, transformOrigin: "50% 50%" });
      gsap.timeline({ onComplete: () => r.remove() })
        .to(r, { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.7 - 40, rotation: "+=" + (Math.random() * 540 - 270), duration: 0.7, ease: "power3.out" })
        .to(r, { y: "+=110", opacity: 0, duration: 0.9, ease: "power1.in" });
    }
  }
  function sparkle(x, y, n = 10, dist = 60) {
    if (!forward) return;
    for (let i = 0; i < n; i++) {
      const p = document.createElementNS(NS, "path");
      p.setAttribute("d", "M0 -8 L2.2 -2.2 8 0 2.2 2.2 0 8 -2.2 2.2 -8 0 -2.2 -2.2Z");
      p.setAttribute("fill", i % 2 ? "#F2C66B" : "#FFF4E3");
      fx.appendChild(p);
      const a = (i / n) * Math.PI * 2;
      gsap.set(p, { x, y, scale: 0 });
      gsap.to(p, { x: x + Math.cos(a) * dist, y: y + Math.sin(a) * dist, scale: 1.2, rotation: 180, duration: 0.6, ease: "power2.out" });
      gsap.to(p, { scale: 0, opacity: 0, duration: 0.4, delay: 0.45, onComplete: () => p.remove() });
    }
  }
  function puff(x, y) {
    if (!forward) return;
    const c = document.createElementNS(NS, "circle");
    c.setAttribute("r", 7); c.setAttribute("fill", "#E5D2B3");
    fx.appendChild(c);
    gsap.set(c, { x, y, scale: 0.4, opacity: 0.9, transformOrigin: "50% 50%" });
    gsap.to(c, { x: x - 30, y: y - 14, scale: 1.6, opacity: 0, duration: 0.8, ease: "power1.out", onComplete: () => c.remove() });
  }

  /* ---------- camera (mobile: the scene scrolls sideways) ---------- */
  const pan = (svgX) => {
    if (!scroller || scroller.scrollWidth <= scroller.clientWidth + 4) return;
    const target = (svgX / 1200) * scroller.scrollWidth - scroller.clientWidth / 2;
    gsap.to(scroller, { scrollLeft: Math.max(0, Math.min(target, scroller.scrollWidth - scroller.clientWidth)), duration: 0.8, ease: "power2.out", overwrite: true });
  };

  /* ---------- step / caption sync ---------- */
  let shownStep = -1;
  function showStep(n) {
    if (n === shownStep) return;
    shownStep = n;
    steps.forEach((s, i) => { s.classList.toggle("is-active", i === n); s.classList.toggle("is-done", i < n); });
    gsap.to(caption, { opacity: 0, y: 6, duration: 0.15, overwrite: true, onComplete: () => { caption.innerHTML = CAPTIONS[n]; gsap.to(caption, { opacity: 1, y: 0, duration: 0.25 }); } });
    pan(CAMERA[n]);
  }

  /* ---------- opening state ---------- */
  $("#jToy").setAttribute("href", "#toy-bear");
  $("#jToy").setAttribute("x", -205); $("#jToy").setAttribute("y", -90);
  // The gift is positioned through a plain proxy + explicit transform attribute:
  // deterministic under scroll-scrubbing (no SVG-origin maths involved).
  const giftEl = svg.querySelector("#jGift");
  const G = { x: 640, y: 470, sx: 1, sy: 1 };
  const renderGift = () => giftEl.setAttribute("transform", `translate(${G.x} ${G.y}) scale(${G.sx} ${G.sy})`);
  renderGift();
  gsap.set(["#jCoin1", "#jCoin2", "#jCoin3"], { x: 180, y: 300, scale: 0, opacity: 0, transformOrigin: "50% 50%" });
  gsap.set(["#jCash1", "#jCash2"], { x: 290, y: 300, scale: 0, opacity: 0, transformOrigin: "50% 50%" });
  gsap.set("#jRewardLabel", { x: 110, y: 196, opacity: 0, scale: 0.6, transformOrigin: "50% 50%" });
  gsap.set("#jBought", { x: 480, y: 330, opacity: 0, scale: 0.4, transformOrigin: "50% 50%" });
  $("#jBought text").textContent = "$" + TOY_PRICE + " → a toy";
  $("#jBought rect").setAttribute("x", -62); $("#jBought rect").setAttribute("width", 124);
  gsap.set("#jToy", { opacity: 0, scale: 0, transformOrigin: "50% 100%" });
  gsap.set("#jPaper", { scaleX: 0, transformOrigin: "0% 50%" });
  gsap.set("#jLidPaper", { scaleX: 0, transformOrigin: "100% 50%" });
  gsap.set("#jRibbonV", { scaleY: 0, transformOrigin: "50% 0%" });
  gsap.set("#jRibbonH", { scaleX: 0, transformOrigin: "100% 50%" });
  gsap.set("#jLidRibbon", { scaleY: 0, transformOrigin: "50% 100%" });
  gsap.set("#jBow", { scale: 0, rotation: -30, transformOrigin: "50% 50%" });
  gsap.set("#jTag", { opacity: 0, rotation: -40, transformOrigin: "0% 50%" });
  gsap.set("#jLid", { svgOrigin: "0 -96" });
  gsap.set("#jLid", { x: 95, y: -60, rotation: 28 });
  gsap.set(["#jArmL", "#jArmR"], { transformOrigin: "50% 6%" });
  gsap.set("#jMouthOpen", { opacity: 0 });
  gsap.set("#jBubble", { opacity: 0, scale: 0.4, transformOrigin: "85% 100%" });
  gsap.set(["#jCharityGlow", "#jNodeGlow"], { opacity: 0 });
  gsap.set(["#jStar", "#jTreeStar", "#jWheel1", "#jWheel2", "#jFund"], { transformOrigin: "50% 50%" });
  gsap.set("#jLastCandle", { transformOrigin: "50% 100%" });
  gsap.set("#jDoor", { transformOrigin: "0% 50%" });
  gsap.set("#jTradeBtn", { transformOrigin: "50% 50%" });

  /* ---------- the story (durations are relative: scroll maps onto them) ---------- */
  const fund = { v: 0 };
  const tl = gsap.timeline({ paused: true, defaults: { ease: "power2.inOut" } });

  // 01 — a trade mints a creator-reward coin
  tl.addLabel("s0")
    .to("#jTradeBtn", { scale: 0.9, duration: 0.15, yoyo: true, repeat: 1 })
    .fromTo("#jLastCandle", { scaleY: 0.2 }, { scaleY: 1.35, duration: 0.5, ease: "back.out(2)" }, "<")
    .to("#jRewardLabel", { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(2)" }, "-=.2");
  ["#jCoin1", "#jCoin2", "#jCoin3"].forEach((c, i) => {
    tl.to(c, { opacity: 1, scale: 0.8, x: 180 + i * 8, y: 300 - i * 30, duration: 0.4, ease: "back.out(2.6)" }, i ? "-=.2" : "-=.1");
  });

  // 02 — coins → donate.gg → dollars → Toys for Tots
  tl.addLabel("s1", "+=.3")
    .to("#jRewardLabel", { opacity: 0, y: "-=16", duration: 0.3 }, "s1");
  ["#jCoin1", "#jCoin2", "#jCoin3"].forEach((c, i) => {
    tl.to(c, { keyframes: { x: [180 + i * 8, 240, 290], y: [300 - i * 30, 230, 300], ease: "none" }, rotation: 540, scale: 0.4, duration: 0.7, ease: "power2.in" }, i ? "<.15" : "s1+=.1")
      .to(c, { opacity: 0, duration: 0.1 }, ">-.05");
  });
  tl.to("#jNodeGlow", { opacity: 1, duration: 0.3, yoyo: true, repeat: 1 }, "-=.3")
    .to("#jNode", { scale: 1.08, svgOrigin: "290 300", duration: 0.15, yoyo: true, repeat: 3, ease: "power1.inOut" }, "<")
    .call(() => sparkle(290, 300, 8, 50), null, "<.2");
  ["#jCash1", "#jCash2"].forEach((c, i) => {
    tl.to(c, { opacity: 1, scale: 1, duration: 0.25, ease: "back.out(2)" }, i ? "<.2" : "-=.05")
      .to(c, { keyframes: { x: [290, 370, 450, 480], y: [300, 240, 300, 420], ease: "none" }, rotation: i ? -18 : 14, duration: 0.9 }, "<.1")
      .to(c, { scale: 0.3, opacity: 0, duration: 0.2 }, ">-.1");
  });
  tl.to(fund, { v: TOY_PRICE, duration: 0.7, ease: "power2.out" }, "-=.8")
    .to("#jFund", { scale: 1.15, duration: 0.18, yoyo: true, repeat: 1 }, "-=.2")
    .to("#jCharityGlow", { opacity: 0.8, duration: 0.4, yoyo: true, repeat: 1 }, "<");

  // 03 — the money becomes a gift
  tl.addLabel("s2", "+=.3")
    .to("#jDoor", { scaleX: 0.12, duration: 0.4 }, "s2")
    .to("#jToy", { opacity: 1, scale: 0.75, duration: 0.5, ease: "back.out(2.4)" }, "-=.1")
    .to("#jBought", { opacity: 1, scale: 1, y: 312, duration: 0.45, ease: "back.out(2.4)" }, "<.1")
    .call(() => sparkle(480, 420, 10, 55), null, "<")
    .to("#jBought", { opacity: 0, y: 290, duration: 0.3 }, "+=.4")
    .to("#jDoor", { scaleX: 1, duration: 0.4 }, "<")
    .to("#jToy", { keyframes: [
      { attr: { x: -125, y: -205 }, scale: 0.9, duration: 0.4, ease: "power1.out" },
      { attr: { x: -45, y: -190 }, scale: 1, duration: 0.4, ease: "power1.in" },
    ] }, "<")
    .to("#jToy", { attr: { y: -86 }, duration: 0.45, ease: "power2.in" })
    .to(G, { sy: 0.93, sx: 1.05, duration: 0.12, yoyo: true, repeat: 1, ease: "power1.out" })
    .to("#jPaper", { scaleX: 1, duration: 0.55 })
    .to("#jLid", { x: 0, y: 0, rotation: 0, duration: 0.7, ease: "back.out(1.4)" }, "-=.25")
    .to("#jLidPaper", { scaleX: 1, duration: 0.45 }, "-=.35")
    .to("#jRibbonV", { scaleY: 1, duration: 0.3, ease: "power2.out" })
    .to("#jLidRibbon", { scaleY: 1, duration: 0.2 }, "<")
    .to("#jRibbonH", { scaleX: 1, duration: 0.3, ease: "power2.out" }, "-=.12")
    .to("#jBow", { scale: 1, rotation: 0, duration: 0.8, ease: "elastic.out(1, .45)" }, "-=.1")
    .call(() => sparkle(640, 352, 10, 55), null, "<.1")
    .to("#jTag", { opacity: 1, rotation: 0, duration: 0.8, ease: "elastic.out(1, .4)" }, "<.15");

  // 04 — delivered by van
  tl.addLabel("s3", "+=.2")
    .to("#jGiftShadow", { opacity: 0, duration: 0.2 }, "s3")
    .to(G, { keyframes: { x: [640, 700, 752], y: [470, 340, 400], ease: "none" }, sx: 0.55, sy: 0.55, duration: 0.7 }, "<")
    .to("#jVan", { y: 3, duration: 0.1, yoyo: true, repeat: 1 })
    .to(["#jWheel1", "#jWheel2"], { rotation: 720, duration: 1.3 })
    .to("#jVan", { x: 110, duration: 1.3 }, "<")
    .to(G, { x: 862, duration: 1.3 }, "<")
    .call(() => puff(700, 452), null, "<.1")
    .call(() => puff(760, 452), null, "<.5")
    .to(G, { keyframes: { x: [862, 920, 972], y: [400, 330, 470], ease: "none" }, sx: 0.6, sy: 0.6, duration: 0.75 }, "+=.1")
    .to("#jGiftShadow", { opacity: 0.1, duration: 0.2 }, ">-.1")
    .to(["#jWheel1", "#jWheel2"], { rotation: "+=900", duration: 1.2, ease: "power2.in" }, "<")
    .to("#jVan", { x: 520, opacity: 0, duration: 1.2, ease: "power2.in" }, "<");

  // 05 — a kid's Christmas
  tl.addLabel("s4", "-=.7")
    .to("#jKid", { x: -36, duration: 0.6, ease: "power2.out" }, "s4")
    .to("#jMouth", { opacity: 0, duration: 0.1 })
    .to("#jMouthOpen", { opacity: 1, duration: 0.1 }, "<")
    .to("#jArmL", { rotation: 150, duration: 0.45, ease: "back.out(2)" }, "<")
    .to("#jArmR", { rotation: -150, duration: 0.45, ease: "back.out(2)" }, "<")
    .to("#jKidBody", { y: -22, duration: 0.2, yoyo: true, repeat: 3, ease: "power1.out" }, "<")
    .to("#jLid", { y: -150, x: -80, rotation: -45, opacity: 0, duration: 0.7, ease: "power2.out" }, "<.2")
    .to("#jToy", { attr: { y: -210 }, duration: 0.55, ease: "back.out(2)" }, "<.05")
    .call(() => burst(1000, 360, 34), null, "<")
    .to("#jTreeStar", { rotation: 216, scale: 1.4, duration: 0.6, yoyo: true, repeat: 1, ease: "back.out(2)" }, "<")
    .to("#jToy", { attr: { x: 105, y: -170 }, duration: 0.6 }, "+=.15")
    .to("#jArmL", { rotation: -35, duration: 0.45, ease: "power2.out" }, "<.3")
    .to("#jArmR", { rotation: 35, duration: 0.45, ease: "power2.out" }, "<")
    .to("#jBubble", { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(2.4)" }, "<.1")
    .to({}, { duration: 0.6 }); // a beat to enjoy the ending before the pin releases

  const LABELS = ["s0", "s1", "s2", "s3", "s4"].map((l) => tl.labels[l]);
  const stepAt = (t) => { let n = 0; LABELS.forEach((lt, i) => { if (t >= lt - 0.05) n = i; }); return n; };

  ScrollTrigger.create({
    trigger: pinEl,
    start: () => (pinEl.offsetHeight < innerHeight - 40 ? "center center" : "top top"),
    end: () => "+=" + Math.round(innerHeight * 3.2),
    pin: true,
    scrub: 0.8,
    animation: tl,
    anticipatePin: 1,
    refreshPriority: 1, // this pin adds scroll distance — measure it before the triggers below it
    invalidateOnRefresh: true,
    onUpdate: (self) => {
      forward = self.direction === 1;
    },
  });
  // follow the (smoothed) animation time, not the raw scroll position
  tl.eventCallback("onUpdate", () => {
    renderGift();
    fundAmt.textContent = "$" + Math.round(fund.v);
    progressBar.style.transform = `scaleX(${tl.progress()})`;
    showStep(stepAt(tl.time()));
  });
  showStep(0);
  ScrollTrigger.refresh();
})();
