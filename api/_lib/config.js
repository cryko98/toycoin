'use strict';
/*
 * Server-side settings for the gift meter. Every value can be overridden with a Vercel env var.
 *
 *   TOY_MINT          $TOY contract address (empty until launch → the meter reports "awaiting launch")
 *   DONATE_CHARITY_ID donate.gg charity id of the beneficiary (default: Marine Toys for Tots Foundation)
 *   DONATE_CONFIG_ID  optional: pin the donate.gg donation config (0x… hex). Normally it is read from the
 *                     coin's own Pump Fees donation account on-chain, so you don't need to set it.
 *   SOLANA_RPC_URLS   comma-separated RPC URLs, primary first (e.g. add a Helius URL as backup)
 *   DONATE_API_KEY    donate.gg API key for a higher rate limit
 *
 * Keep TOY_MINT in sync with `mint` in js/config.js (that one drives the CA / buy links on the page).
 */
module.exports = Object.freeze({
  mint: (process.env.TOY_MINT || '').trim(),
  charityId: (process.env.DONATE_CHARITY_ID || '1756826b-8b9b-5f09-a95c-98ff34592a89').trim(),
  charityName: 'Toys for Tots',
  configId: (process.env.DONATE_CONFIG_ID || '').trim().toLowerCase() || null,
  usdPerToy: 25
});
