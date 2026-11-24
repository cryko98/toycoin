/* =====================================================================
   TOYCOIN — 3D coin (Three.js)
   Gold coin with the Toycoin logo on both faces, reeded edge,
   raised rims, engraved rim lettering. Drag to spin, reacts to scroll.
===================================================================== */
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const wrap = document.getElementById("coinWrap");
const canvas = document.getElementById("coin");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

function loadImage(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

/* ---------- canvas-painted face texture ---------- */
function paintFace(logo) {
  const S = 1024, c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d"), C = S / 2;

  // gold band
  const gold = g.createRadialGradient(C * 0.7, C * 0.6, 40, C, C, C);
  gold.addColorStop(0, "#F6D488"); gold.addColorStop(0.55, "#D9A441"); gold.addColorStop(1, "#9C6C1A");
  g.fillStyle = gold; g.fillRect(0, 0, S, S);

  // fine guilloché rings on the band
  g.strokeStyle = "rgba(110, 70, 10, .22)"; g.lineWidth = 2;
  for (let r = C * 0.83; r < C * 0.99; r += 9) { g.beginPath(); g.arc(C, C, r, 0, Math.PI * 2); g.stroke(); }

  // engraved lettering around the band
  const text = "TOYCOIN  ✦  $TOY  ✦  EVERY TRADE WRAPS A GIFT  ✦  ";
  g.font = "700 50px 'Fraunces', Georgia, serif";
  g.fillStyle = "#5E1016";
  g.textAlign = "center"; g.textBaseline = "middle";
  const R = C * 0.905, chars = [...text], step = (Math.PI * 2) / chars.length;
  chars.forEach((ch, i) => {
    const a = -Math.PI / 2 + i * step;
    g.save(); g.translate(C + Math.cos(a) * R, C + Math.sin(a) * R); g.rotate(a + Math.PI / 2);
    g.fillText(ch, 0, 0); g.restore();
  });

  // inner bevel
  g.beginPath(); g.arc(C, C, C * 0.815, 0, Math.PI * 2);
  g.lineWidth = 16; g.strokeStyle = "#8A5C12"; g.stroke();
  g.beginPath(); g.arc(C, C, C * 0.8, 0, Math.PI * 2);
  g.lineWidth = 6; g.strokeStyle = "#F8DA92"; g.stroke();

  // logo medallion
  g.save(); g.beginPath(); g.arc(C, C, C * 0.79, 0, Math.PI * 2); g.clip();
  const inset = S * 0.105;
  g.drawImage(logo, inset - S * 0.03, inset - S * 0.02, S - inset * 2 + S * 0.06, S - inset * 2 + S * 0.06);
  // soft vignette for depth
  const vg = g.createRadialGradient(C, C, C * 0.5, C, C, C * 0.8);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(60,0,10,.35)");
  g.fillStyle = vg; g.fillRect(0, 0, S, S);
  g.restore();
  return c;
}

/* reeded edge bump map */
function paintEdge() {
  const c = document.createElement("canvas"); c.width = 512; c.height = 8;
  const g = c.getContext("2d");
  for (let x = 0; x < 512; x += 4) { g.fillStyle = x % 8 ? "#222" : "#fff"; g.fillRect(x, 0, 4, 8); }
  return c;
}

async function init() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (e) { wrap.classList.add("no-webgl"); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 6.2);

  // lights: warm key, red rim, gold fill
  const key = new THREE.DirectionalLight(0xfff1d6, 2.4); key.position.set(3, 4, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0xff5560, 2.2); rim.position.set(-4, -1, -3); scene.add(rim);
  const fill = new THREE.PointLight(0xf2c66b, 18, 12); fill.position.set(-3, 2, 3); scene.add(fill);
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));

  try { await document.fonts.load("700 50px Fraunces"); } catch { /* fallback font */ }
  const logo = await loadImage("assets/logo.jpg");
  const faceCanvas = paintFace(logo);

  // Both cylinder caps share the same UV orientation once the coin faces the
  // camera, so the same un-mirrored texture reads correctly on each side.
  const mkFaceTex = () => {
    const t = new THREE.CanvasTexture(faceCanvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    t.center.set(0.5, 0.5);
    t.rotation = Math.PI / 2;
    return t;
  };
  const faceMat = (tex) => new THREE.MeshPhysicalMaterial({
    map: tex, metalness: 0.45, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25,
    emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.14,
  });

  const edgeTex = new THREE.CanvasTexture(paintEdge());
  edgeTex.wrapS = THREE.RepeatWrapping; edgeTex.repeat.set(14, 1);
  const goldMat = new THREE.MeshPhysicalMaterial({ color: 0xd9a441, metalness: 1, roughness: 0.26, bumpMap: edgeTex, bumpScale: 2.2, clearcoat: 0.4 });
  const rimMat = new THREE.MeshPhysicalMaterial({ color: 0xe2b252, metalness: 1, roughness: 0.2, clearcoat: 0.8 });

  const R = 1.3, T = 0.2;
  const coin = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, T, 160, 1), [goldMat, faceMat(mkFaceTex()), faceMat(mkFaceTex())]);
  body.geometry.rotateX(Math.PI / 2);
  coin.add(body);
  [1, -1].forEach((s) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R - 0.045, 0.05, 24, 160), rimMat);
    ring.position.z = s * T / 2; coin.add(ring);
  });
  scene.add(coin);

  // orbiting gold sparkles
  const N = 140, pos = new Float32Array(N * 3), seeds = [];
  for (let i = 0; i < N; i++) seeds.push({ r: 1.7 + Math.random() * 1.1, a: Math.random() * Math.PI * 2, y: (Math.random() - 0.5) * 2.8, s: 0.15 + Math.random() * 0.35 });
  const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const sprite = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,240,200,1)"); gr.addColorStop(0.3, "rgba(242,198,107,.8)"); gr.addColorStop(1, "rgba(242,198,107,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const sparkles = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.09, map: sprite, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(sparkles);

  // contact shadow
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.2, 48), new THREE.MeshBasicMaterial({ color: 0x3a0007, transparent: true, opacity: 0.28 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -1.95; shadow.scale.set(1, 0.32, 1);
  scene.add(shadow);

  /* ---------- sizing ---------- */
  const resize = () => {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  resize(); new ResizeObserver(resize).observe(wrap);

  /* ---------- interaction ---------- */
  // Click / touch + drag rotates the coin freely on both axes (with inertia).
  // Released, it eases back into its idle spin.
  const IDLE = reduce ? 0.003 : 0.012;
  let spin = 0.4, spinVel = IDLE, flipVel = 0, flip = 0, dragging = false, lastX = 0, lastY = 0, lastT = 0;
  let tiltX = 0, tiltY = 0, targetTX = 0, targetTY = 0;
  const hint = wrap.querySelector(".coin-hint");
  wrap.addEventListener("pointerdown", (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    dragging = true; lastX = e.clientX; lastY = e.clientY; lastT = performance.now();
    spinVel = 0; flipVel = 0;
    wrap.setPointerCapture(e.pointerId);
    wrap.classList.add("is-dragging");
    if (hint) hint.style.opacity = "0";
  });
  wrap.addEventListener("pointermove", (e) => {
    const r = wrap.getBoundingClientRect();
    if (dragging) {
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      const k = 3.2 / r.width; // a full drag across ≈ half a turn
      spin += dx * k; flip += dy * k;
      const now = performance.now(), dt = Math.max(16, now - lastT);
      spinVel = (dx * k) * (16 / dt); flipVel = (dy * k) * (16 / dt);
      lastX = e.clientX; lastY = e.clientY; lastT = now;
    } else {
      targetTX = ((e.clientY - r.top) / r.height - 0.5) * 0.5;
      targetTY = ((e.clientX - r.left) / r.width - 0.5) * 0.5;
    }
  });
  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    wrap.classList.remove("is-dragging");
    try { wrap.releasePointerCapture(e.pointerId); } catch { /* already released */ }
  };
  wrap.addEventListener("pointerup", end); wrap.addEventListener("pointercancel", end);
  wrap.addEventListener("pointerleave", () => { if (!dragging) targetTX = targetTY = 0; });

  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(wrap);

  const clock = new THREE.Clock();
  const loop = () => {
    requestAnimationFrame(loop);
    if (!visible) return;
    const t = clock.getElapsedTime();
    if (!dragging) {
      const sv = (window.__scrollVelocity || 0) * 0.0035;
      spinVel += (IDLE - spinVel) * 0.025;          // inertia → idle spin
      flipVel *= 0.94;
      spin += spinVel + sv;
      flip += flipVel;
      // settle the flip axis to the nearest face (0 or π) once momentum dies
      if (Math.abs(flipVel) < 0.004) {
        const target = Math.round(flip / Math.PI) * Math.PI;
        flip += (target - flip) * 0.05;
      }
    }
    tiltX += (targetTX - tiltX) * 0.06; tiltY += (targetTY - tiltY) * 0.06;
    coin.rotation.set(flip + tiltX + Math.sin(t * 0.8) * 0.06, spin + tiltY, Math.sin(t * 0.6) * 0.05);
    coin.position.y = Math.sin(t * 1.3) * 0.08 + 0.15;
    shadow.scale.x = 1 - Math.sin(t * 1.3) * 0.06;

    for (let i = 0; i < N; i++) {
      const s = seeds[i]; s.a += s.s * 0.01;
      pos[i * 3] = Math.cos(s.a) * s.r; pos[i * 3 + 1] = s.y + Math.sin(t + i) * 0.05; pos[i * 3 + 2] = Math.sin(s.a) * s.r * 0.6;
    }
    pGeo.attributes.position.needsUpdate = true;
    sparkles.material.opacity = 0.65 + Math.sin(t * 2) * 0.25;
    renderer.render(scene, camera);
  };
  loop();
}

init().catch((e) => { console.error(e); wrap.classList.add("no-webgl"); });
