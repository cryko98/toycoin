'use strict';
// Renders video/promo.html (1080×1920) frame-by-frame with headless Chrome.
//   node render.js stills <outDir> [t1,t2,…]   → PNG key frames for review
//   node render.js video  <out.mp4>             → silent H.264 video (audio is mixed by mix.js)
// Needs the site served at BASE (npm run dev in the repo root) and Chrome installed.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');
const ffmpeg = require('ffmpeg-static');

const BASE = process.env.BASE || 'http://localhost:5173';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FPS = +(process.env.FPS || 30);
const [mode, out, list] = process.argv.slice(2);

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--force-device-scale-factor=1', '--hide-scrollbars', '--font-render-hinting=none', '--disable-gpu-vsync']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('PAGE ERROR', e.message));
  page.on('console', m => m.type() === 'error' && console.error('CONSOLE', m.text()));
  await page.goto(`${BASE}/video/promo.html`, { waitUntil: 'networkidle0' });
  await page.waitForFunction('window.__ready === true', { timeout: 60000 });
  const duration = await page.evaluate('window.__duration');

  if (mode === 'stills') {
    fs.mkdirSync(out, { recursive: true });
    const times = list ? list.split(',').map(Number) : [1.2, 3.2, 4.6, 6.4, 8.6, 11.8, 14.2, 16.4, 18.4, 20.6, 22.6, 24.9, 26.5, 28.7, 30.8, 33.2, 35.6, 37.8, 41, 44];
    for (const t of times) {
      // step up to t so tweens that depend on earlier state are rendered as in the real video
      for (let k = Math.max(0, t - 1.2); k < t; k += 1 / 10) await page.evaluate(x => window.__seek(x), k);
      await page.evaluate(x => window.__seek(x), t);
      await page.screenshot({ path: path.join(out, `t${t.toFixed(1).padStart(4, '0')}.png`) });
    }
    console.log('stills →', out);
  } else {
    const ff = spawn(ffmpeg, ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', String(FPS), '-movflags', '+faststart', out],
    { stdio: ['pipe', 'inherit', 'inherit'] });
    const frames = Math.round(duration * FPS), t0 = Date.now();
    for (let f = 0; f < frames; f++) {
      await page.evaluate(x => window.__seek(x), f / FPS);
      const buf = await page.screenshot({ type: 'jpeg', quality: 94, optimizeForSpeed: true });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (f % 90 === 0) console.log(`frame ${f}/${frames} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
    console.log('video →', out);
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
