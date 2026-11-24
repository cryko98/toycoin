# Toycoin ($TOY)

**Every trade wraps a gift.** A Solana charity memecoin launched on pump.fun as a donate.gg Charity Coin — 100% of the creator rewards go to Toys for Tots.

- Site: `index.html`, `css/style.css`, `js/main.js` (motion), `js/coin.js` (3D coin), `js/journey.js` (scroll-driven gift journey), `js/meter.js` (gift-tracker client), assets in `assets/`.
- API: `api/meter.js`, a Vercel serverless function (accounting core in `api/_lib/meter-core.js`, settings in `api/_lib/config.js`).

## Gift tracker — same model as the FoodCoin meal meter

Two sources, never mixed:

| Shown as | Source | Counted? |
| --- | --- | --- |
| **Delivered to Toys for Tots** ($) | donate.gg public receipts for the charity, filtered to the $TOY mint, `settled` (receipt + parent), USDC settlement, Pump Fees source, wSOL input, valid settlement tx. Summed **net** of donate.gg's fee with `BigInt`. | ✅ the only "delivered" number |
| **≈ Toys funded** | `floor(sum(usdNetE6) / ($25 × 1e6))` — one floor after summing. No live SOL price. | ✅ (derived) |
| **Sent to donate.gg** (SOL) | on-chain `total_donated` counter of the coin's Pump Fees donation account | ❌ on its way |
| **Still under the tree** (SOL) | creator vault + PumpSwap vault + donation account balance (finalized reads) | ❌ on its way |

- The donate.gg config a receipt must carry is read from the coin's own donation account on-chain (or pinned with `DONATE_CONFIG_ID`).
- Every page of receipts is read before publishing; receipts are deduplicated by receipt id (batched settlements share one tx); already-counted receipts must stay present and unchanged, otherwise the last good reading stays published.
- Chain failures never block the settled total and vice versa. RPC failover with redacted errors.
- The browser only calls the same-origin `/api/meter` (cached 30 s at the edge).

Verified against a live Toys for Tots charity coin (Nov 24, 2026): the on-chain `total_donated` (51.719532802 SOL) equals the summed SOL of its 5 settled receipts exactly, and the on-chain config id matches the receipts.

## Launch settings

1. **Vercel → Environment Variables:** `TOY_MINT` = the $TOY contract address. Optional: `SOLANA_RPC_URLS` (e.g. add a Helius URL as backup), `DONATE_API_KEY`, `DONATE_CONFIG_ID`, `DONATE_CHARITY_ID`.
2. **`js/config.js`:** the same `mint` (drives the CA pill and the pump.fun buy links) and `links.x`.

With an empty mint the tracker shows "waiting for the contract address".

The beneficiary is **Marine Toys for Tots Foundation** on donate.gg (`1756826b-8b9b-5f09-a95c-98ff34592a89`, listed as `ACTIVE_NOT_ONBOARDED`). Its settled receipts show donate.gg deducting a 20% processing fee on Charity Coin donations.

## Run locally

```bash
npm install
npm run dev        # site + /api/meter on http://localhost:5173
npm test
```

Preview the tracker with real data from another coin: `TOY_MINT=<mint> npm run dev`.

## Deploy

Vercel: import the repo — the static site and the `/api/meter` function deploy together. A static-only host (GitHub Pages) would serve the page, but the tracker needs the `/api` function.

Toycoin is an independent community project, not affiliated with the Marine Toys for Tots Foundation, the U.S. Marine Corps, pump.fun or donate.gg.
