# Toycoin — TikTok promo (45 s, 1080×1920)

Motion-designed explainer built as an HTML/GSAP composition and rendered frame-by-frame — every frame is
deterministic, so re-renders are identical. Voice, music, SFX and the three mood photos are generated on fal.ai.

| File | What it does |
| --- | --- |
| `gen.js` | fal.ai: ElevenLabs v3 voice-over (with timestamps), ElevenLabs music, 7 SFX, 3 FLUX.3 photos → `gen/` |
| `words.js` | character timestamps → word timings (`gen/words.json`) that drive scene cuts and captions |
| `promo.html` | the composition (8 scenes, toy-block kinetic type, ribbon / wrapping-paper transitions, 3D coin, captions) |
| `render.js` | headless Chrome → frames → H.264 (`stills` mode for review sheets) |
| `mix.js` | music ducked under the voice + SFX on the visual beats, −14 LUFS, muxed onto the render |

## Rebuild

```bash
cd video && npm install
FAL_KEY=… node gen.js all && node words.js        # only if you want new voice/music/images
# serve the repo root (npm run dev in the parent folder), then:
BASE=http://localhost:5173 node render.js video gen/video-silent.mp4
node mix.js gen/video-silent.mp4 toycoin-tiktok.mp4
```

No contract address appears anywhere in the video.

## Post copy (TikTok)

> What if every memecoin trade bought a kid a Christmas present? 🎁 $TOY sends 100% of its pump.fun creator rewards to Toys for Tots through donate.gg — and you can watch every dollar land on our live tracker. 30 days to Christmas. Follow so you don't miss the launch 🧸
>
> #memecoin #solana #pumpfun #crypto #charity #christmas #toysfortots #giveback #cryptotok #fyp

Not affiliated with Toys for Tots. Not financial advice.
