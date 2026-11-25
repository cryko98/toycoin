'use strict';
// Mixes the soundtrack (music ducked under the voice + SFX on the visual beats) and muxes it
// onto the silent render.   node mix.js gen/video-silent.mp4 toycoin-tiktok.mp4
const path = require('path');
const { spawnSync } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const words = require('./gen/words.json');

const [video, out] = process.argv.slice(2);
const OFF = 0.3, DURATION = 45;
const G = f => path.join(__dirname, 'gen', f);
// same lookup as promo.html: n-th occurrence of a spoken word → video time
const at = (w, n = 0) => {
  let k = -1;
  for (let i = 0; i <= n; i++) k = words.findIndex((x, j) => j > k && x.w.toLowerCase().replace(/[^a-z0-9%$'-]/g, '') === w);
  return OFF + words[k].s;
};

// [file, time (s), volume]
const sfx = [
  ['pop', 0.02, .5], ['boom', at('present') - .05, .8], ['pop', at('bought') + .25, .45], ['sparkle', at('present'), .55],
  ['whoosh', 5.0 - .35, .7],                                   // ribbon → S2
  ['pop', at('toy') - .15, .5], ['boom', at('toy') + .45, .55], ['sparkle', at('meet'), .4],
  ['rip', 12.55 - .3, .6],                                     // tear → S3
  ['coin', at('pays'), .7], ['pop', at('creator'), .4],
  ['boom', at('percent') + .1, .75],
  ['coin', at('through') - .25, .6],
  ['whoosh', at('that') - .4, .7],                             // ribbon → S5
  ['pop', at('real') - .1, .45],
  ['rip', at('wrapped') - .25, .6], ['sparkle', at('wrapped') + .3, .6],
  ['rip', at('delivered') - .05, .65],
  ['pop', at('christmas', 1) - .1, .4],
  ['rip', at('and', 2) - .35, .6],                             // tear → S6
  ['coin', at('dollar') - .1, .55], ['boom', at('on-chain') + .1, .6],
  ['whoosh', at('christmas', 2) - .4, .7], ['bells', at('christmas', 2), .55],
  ['pop', at('thirty') - .2, .5],
  ['rip', at('every', 3) - .35, .6],                           // tear → S8
  ['pop', at('every', 3), .4], ['boom', at('gift') + .2, .8],
  ['sparkle', at('follow') - .1, .6], ['bells', at('follow') + .2, .5]
];

const args = ['-y', '-i', video, '-i', G('music.mp3'), '-i', G('vo.mp3')];
sfx.forEach(([f]) => args.push('-i', G(`sfx-${f}.mp3`)));

const parts = [
  `[1:a]volume=0.55,afade=t=in:d=0.4,afade=t=out:st=${DURATION - 1.8}:d=1.8,atrim=0:${DURATION}[mus]`,
  `[2:a]adelay=${Math.round(OFF * 1000)}|${Math.round(OFF * 1000)},volume=1.35,asplit=2[vo][vokey]`,
  `[mus][vokey]sidechaincompress=threshold=0.035:ratio=6:attack=15:release=320:makeup=1[duck]`
];
sfx.forEach(([, t, v], i) => {
  const ms = Math.max(0, Math.round(t * 1000));
  parts.push(`[${i + 3}:a]volume=${v},adelay=${ms}|${ms}[s${i}]`);
});
parts.push(`[duck][vo]${sfx.map((_, i) => `[s${i}]`).join('')}amix=inputs=${sfx.length + 2}:normalize=0:duration=longest,atrim=0:${DURATION},loudnorm=I=-14:TP=-1.2:LRA=9[aout]`);

args.push('-filter_complex', parts.join(';'), '-map', '0:v', '-map', '[aout]',
  '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-t', String(DURATION), '-movflags', '+faststart', out);

const r = spawnSync(ffmpeg, args, { stdio: ['ignore', 'inherit', 'pipe'] });
if (r.status !== 0) { console.error(String(r.stderr).split('\n').slice(-25).join('\n')); process.exit(1); }
console.log('→', out);
