'use strict';
// Minimal fal.ai queue client: submit → poll → fetch result → download files.
// Usage (module): const { run, download } = require('./fal'); await run('fal-ai/…', { …input });
// Needs FAL_KEY in the environment.
const fs = require('fs');
const path = require('path');

const KEY = process.env.FAL_KEY;
if (!KEY) throw new Error('FAL_KEY is not set');
const H = { Authorization: 'Key ' + KEY, 'Content-Type': 'application/json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run(model, input, { timeoutMs = 10 * 60 * 1000, log = true } = {}) {
  const sub = await fetch('https://queue.fal.run/' + model, { method: 'POST', headers: H, body: JSON.stringify(input) });
  if (!sub.ok) throw new Error(`${model} submit HTTP ${sub.status}: ${(await sub.text()).slice(0, 400)}`);
  const { status_url, response_url } = await sub.json();
  const t0 = Date.now();
  for (;;) {
    if (Date.now() - t0 > timeoutMs) throw new Error(model + ' timed out');
    await sleep(1500);
    const st = await (await fetch(status_url, { headers: H })).json();
    if (st.status === 'COMPLETED') break;
    if (st.status && !['IN_QUEUE', 'IN_PROGRESS'].includes(st.status)) throw new Error(model + ' status ' + JSON.stringify(st).slice(0, 300));
  }
  const res = await fetch(response_url, { headers: H });
  const out = await res.json();
  if (!res.ok || out.detail) throw new Error(`${model} result: ${JSON.stringify(out).slice(0, 400)}`);
  if (log) console.log(`[fal] ${model} done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return out;
}

async function download(url, file) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('download HTTP ' + r.status);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  return file;
}

module.exports = { run, download };
