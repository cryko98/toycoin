# Toycoin ($TOY)

**Every trade wraps a gift.** A Solana charity memecoin launched on pump.fun as a donate.gg Charity Coin — 100% of the creator rewards go to Toys for Tots.

Static site, no build step: `index.html` + `css/` + `js/` + `assets/`. Deploy the folder as-is to Vercel, Netlify, GitHub Pages or any static host.

## Before launch — edit `js/config.js`

| Key | What to set |
| --- | --- |
| `mint` | The $TOY contract address (CA). Empty until launch → the site shows "drops at launch" and the tracker waits. |
| `rpc` | A browser-friendly Solana RPC **with transaction history**, e.g. a free Helius key: `https://mainnet.helius-rpc.com/?api-key=…`. Without it the site falls back to publicnode, which can read live balances but not past payouts. `api.mainnet-beta.solana.com` blocks browsers (403). |
| `beneficiaries` | Optional. If the fee-sharing config has several shareholders, list the charity wallet(s) so only their share counts as "delivered". |
| `links.donate` | The donate.gg page of the coin / beneficiary. |
| `links.x` | The project's X account. |
| `usdPerToy` | Used for the "≈ toys funded" estimate and the journey animation (default $25). |

## The live tracker (`js/tracker.js`)

Runs entirely in the visitor's browser over Solana JSON-RPC, using the account layouts from pump.fun's public IDLs ([pump-fun/pump-public-docs](https://github.com/pump-fun/pump-public-docs)):

- **Still under the tree (pending)** = pump creator vault balance (minus rent) + PumpSwap creator vault (wSOL) + creator fees still parked on the bonding curve / pool.
- **Delivered to charity** = sum of SOL that landed in the beneficiary wallet(s) in payout transactions (`DistributeCreatorFees`, `CollectCreatorFee`, …) of the creator vault. Results are cached per visitor in `localStorage`, so later visits only fetch new transactions.
- **Generated** = delivered + paid to others + pending.

Fee-sharing (Charity Coin) setups are detected automatically: if the bonding curve's `creator` is the `sharing-config` PDA, its shareholders are read and shown.

## Notes

- Toys for Tots was **not found on donate.gg's charity directory** (Nov 2026). It must be added (donate.gg → "Request a charity") before the coin can name it as a beneficiary.
- Toycoin is an independent community project, not affiliated with the Marine Toys for Tots Foundation, the U.S. Marine Corps, pump.fun or donate.gg.
