/* ------------------------------------------------------------------
   TOYCOIN — site configuration
   Edit this file after launch. Nothing else needs to change.
------------------------------------------------------------------- */
window.TOY_CONFIG = {
  // Contract address (mint) of $TOY on pump.fun. Leave "" until launch.
  mint: "",

  // Solana RPC used by the live tracker (must allow browser/CORS requests
  // and serve transaction history). Strongly recommended: a free Helius key,
  //   "https://mainnet.helius-rpc.com/?api-key=YOUR_KEY"
  // Left empty, the site falls back to publicnode — it reads live balances
  // ("still under the tree") but cannot count past deliveries.
  // Note: api.mainnet-beta.solana.com blocks browser requests (403).
  rpc: "",

  // Optional: if the fee-sharing config has several shareholders, list the
  // charity wallet(s) here so only their share counts as "delivered".
  beneficiaries: [],

  // Links
  links: {
    pump: "https://pump.fun",                     // becomes pump.fun/coin/<mint> automatically when mint is set
    donate: "https://www.donate.gg/charity-coins",  // donate.gg page of the beneficiary / coin
    charity: "https://www.toysfortots.org/",
    x: "https://x.com/",
  },

  // Used for the "≈ toys delivered" estimate on the tracker
  usdPerToy: 25,

  // Christmas countdown target (local time)
  christmas: "2026-12-25T00:00:00",

  // Tracker: refresh interval (ms) and safety cap on history scanning
  refreshMs: 60000,
  maxHistoryTx: 1500,
};
