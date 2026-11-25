/* ------------------------------------------------------------------
   TOYCOIN — site configuration (browser side)
   The live tracker's settings (mint, charity, RPCs, API key) live server-side
   in api/_lib/config.js / Vercel env vars — set TOY_MINT there too.
------------------------------------------------------------------- */
window.TOY_CONFIG = {
  // Contract address (mint) of $TOY on pump.fun. Leave "" until launch.
  // Keep it identical to TOY_MINT on the server.
  mint: "Fzx7qhj3JpYJSGWUMmZUhfM2p6evGSY3fsFRjgHFpump",

  // Links
  links: {
    pump: "https://pump.fun",  // becomes pump.fun/coin/<mint> automatically when mint is set
    donate: "https://www.donate.gg/charities/marine-toys-for-tots-foundation",
    charity: "https://www.toysfortots.org/",
    x: "https://x.com/toycoinpf_",
    tiktok: "https://www.tiktok.com/@toycoinpf",
  },

  // "≈ toys" estimate and the journey animation (keep in sync with usdPerToy on the server)
  usdPerToy: 25,

  // Christmas countdown target (local time)
  christmas: "2026-12-25T00:00:00",
};
