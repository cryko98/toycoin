'use strict';
// Renders banner.html → toycoin-banner-1500x500.png and an @2x version (3000×1000) for sharp displays.
// Usage (from the repo root with the site served at BASE): node banner/render.js
const path = require('path');
const puppeteer = require(path.join(__dirname, '../video/node_modules/puppeteer-core'));
const BASE = process.env.BASE || 'http://localhost:5173';
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--hide-scrollbars', '--font-render-hinting=none'] });
  for (const scale of [1, 2]) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1500, height: 500, deviceScaleFactor: scale });
    await page.goto(`${BASE}/banner/banner.html`, { waitUntil: 'networkidle0' });
    await page.waitForFunction('window.__ready === true', { timeout: 30000 });
    const file = path.join(__dirname, scale === 1 ? 'toycoin-banner-1500x500.png' : 'toycoin-banner-3000x1000@2x.png');
    await page.screenshot({ path: file, clip: { x: 0, y: 0, width: 1500, height: 500 } });
    console.log('→', path.basename(file));
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
