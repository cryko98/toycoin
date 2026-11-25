'use strict';
// Generates the raw media for the TikTok promo on fal.ai (voice, music, SFX, mood images).
// Usage: node gen.js [vo|music|sfx|img|all]   → files in video/gen/
const fs = require('fs');
const path = require('path');
const { run, download } = require('./fal');

const OUT = path.join(__dirname, 'gen');
const what = process.argv[2] || 'all';
const want = k => what === 'all' || what === k;

// Spoken script (written for the ear: "pump dot fun", "donate dot G G"; no contract address).
const VO = [
  '[excited] What if every memecoin trade... bought a kid a Christmas present?',
  'Meet Toycoin. Ticker: TOY. A charity coin on Solana, launching on pump dot fun.',
  'Every time someone buys or sells, the trade pays a creator reward.',
  'And one hundred percent of it goes to Toys for Tots, through donate dot G G.',
  'That money turns into real toys. Wrapped... and delivered to kids who would otherwise wake up to nothing on Christmas morning.',
  'And you can watch every dollar land. Live, on our on-chain tracker.',
  'Christmas is thirty days away.',
  '[warmly] Every trade wraps a gift.',
  'Follow, so you don\'t miss the launch.'
].join(' ');

const SFX = {
  whoosh: 'fast airy whoosh swoosh transition, short, clean',
  boom: 'deep cinematic sub boom impact hit, short tail',
  sparkle: 'magical sparkle chime twinkle, bright, christmas',
  pop: 'playful cartoon pop, bubbly, short',
  bells: 'short sleigh bells jingle shake accent',
  rip: 'wrapping paper ripping tear, quick and crisp',
  coin: 'coins clinking and dropping, bright metallic'
};

const IMG = {
  tree: 'Cozy living room at night, decorated Christmas tree glowing with warm fairy lights, many wrapped presents underneath in deep red and evergreen paper with shiny gold ribbons and bows, cinematic, shallow depth of field, warm bokeh, photorealistic, no people, no text, no logos',
  unwrap: 'Close-up of small child hands pulling a gold satin ribbon off a red gift box, a soft cream teddy bear peeking out of the box, warm golden Christmas light, bokeh background, cinematic photo, hands only, no faces, no text, no logos',
  toys: 'Big cardboard donation box overflowing with brand new toys: plush teddy bears, wooden toy train, toy rocket, rubber duck, wooden letter blocks, festive warm studio light, red and green tones, cinematic product photo, no people, no text, no logos'
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const jobs = [];

  if (want('vo')) jobs.push((async () => {
    const r = await run('fal-ai/elevenlabs/tts/eleven-v3', { text: VO, voice: 'Liam', stability: 0.5, timestamps: true, output_format: 'mp3_44100_192' });
    await download(r.audio.url, path.join(OUT, 'vo.mp3'));
    fs.writeFileSync(path.join(OUT, 'vo-timestamps.json'), JSON.stringify(r.timestamps, null, 1));
  })());

  if (want('music')) jobs.push((async () => {
    const r = await run('elevenlabs/music/v2.5', {
      prompt: 'Festive upbeat Christmas pop-trap instrumental for a TikTok ad. Sleigh bells, glockenspiel and celesta hook, punchy 808 bass, crisp claps and hi-hats, bright, joyful and premium. Short riser into a big drop around 3 seconds, steady groove, a lift around 30 seconds, clean final hit at the end. No vocals.',
      music_length_ms: 47000, force_instrumental: true, output_format: 'mp3_44100_128'
    });
    await download(r.audio.url, path.join(OUT, 'music.mp3'));
  })());

  if (want('sfx')) for (const [k, text] of Object.entries(SFX)) jobs.push((async () => {
    const r = await run('fal-ai/elevenlabs/sound-effects/v2', { text, duration_seconds: k === 'boom' ? 2 : 1.2, prompt_influence: 0.5 });
    await download(r.audio.url, path.join(OUT, `sfx-${k}.mp3`));
  })());

  if (want('img')) for (const [k, prompt] of Object.entries(IMG)) jobs.push((async () => {
    const r = await run('blackforestlabs/flux-3/text-to-image', { prompt, aspect_ratio: '9:16', resolution: '2k', output_format: 'jpeg' });
    await download(r.images[0].url, path.join(OUT, `img-${k}.jpg`));
  })());

  const res = await Promise.allSettled(jobs);
  res.forEach(r => r.status === 'rejected' && console.error('FAILED:', r.reason.message));
  console.log(fs.readdirSync(OUT).join('\n'));
})();
