'use strict';
// Turns ElevenLabs character timestamps (gen/vo-timestamps.json) into word timings (gen/words.json).
const fs = require('fs');
const path = require('path');
const chunks = require('./gen/vo-timestamps.json');
const chars = [];
for (const c of chunks) c.characters.forEach((ch, i) => chars.push({ ch, s: c.character_start_times_seconds[i], e: c.character_end_times_seconds[i] }));
const words = [];
let cur = null, inTag = false;
for (const c of chars) {
  if (c.ch === '[') { inTag = true; continue; }
  if (c.ch === ']') { inTag = false; continue; }
  if (inTag) continue;
  if (/\s/.test(c.ch)) { if (cur) { words.push(cur); cur = null; } continue; }
  if (!cur) cur = { w: '', s: c.s, e: c.e };
  cur.w += c.ch; cur.e = c.e;
}
if (cur) words.push(cur);
const clean = words.filter(w => w.w.replace(/[.,?!]/g, '').length);
fs.writeFileSync(path.join(__dirname, 'gen/words.json'), JSON.stringify(clean.map(w => ({ w: w.w, s: +w.s.toFixed(3), e: +w.e.toFixed(3) })), null, 0));
console.log(clean.length, 'words, last ends', clean[clean.length - 1].e.toFixed(2));
console.log(clean.map(w => `${w.s.toFixed(2)} ${w.w}`).join('\n'));
