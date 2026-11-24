'use strict';
// Run: npm test   (node --test)
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('./meter-core');
const { EXPECTED } = core;

const MINT = '6bYndfKKu7FKho8WEuQKjoByhJAqdVYMXNTouUFgpump'; // any pump mint works for the pure-logic tests
const CFG = '0xd2045b89c765f8cc3dcf17adff15dc3c66ff8f37deb62002b43a000944f0a1f7';
const TX = '47pC87RpCQ9GeB3Lvu6sPjzZf2qb119hFMCLfJDbXdoneXspDDJ3gUGLf2esjXtR7LVcH5Jg7jbGFsMUVDuGGGEj';
let n = 0;
function receipt(over = {}) {
  n++;
  const net = over.net ?? '8000000', fee = over.fee ?? '2000000', tip = over.tip ?? '0';
  let gross = over.gross;
  if (gross === undefined) { try { gross = String(BigInt(net) + BigInt(fee) + BigInt(tip)); } catch { gross = '0'; } }
  return {
    id: over.id ?? `rcpt${n}`,
    status: over.status ?? 'settled',
    settledGrossAtomic: gross, settledNetAtomic: net, settledFeeAtomic: fee, settledTipAtomic: tip,
    usdGrossE6: gross, usdNetE6: net, usdFeeE6: fee, usdTipE6: tip,
    target: { charity: { id: over.charityId ?? EXPECTED.charityId }, chain: { id: 101 }, walletAddress: '8c3RxuNMaN1qMkRB5U6F69cHudT7Aw3uQvKX5y3WRfvW' },
    transactionLog: over.transactionLog ?? { txHash: over.tx ?? TX, blockNumber: '469807246', blockTimestamp: over.at ?? '2026-11-15T17:06:40.000Z' },
    donationReceipt: {
      status: over.parentStatus ?? 'settled',
      inputGrossAtomic: over.lamports ?? '1000000000',
      externalSubject: {
        chainId: 101,
        token: { address: over.mint ?? MINT, chainId: 101 },
        donationSource: { address: over.source ?? EXPECTED.donationSource }
      },
      config: { id: over.configId ?? CFG },
      settlementToken: { address: over.usdc ?? EXPECTED.usdc, decimals: over.decimals ?? 6, chainId: 101 },
      inputToken: { address: over.input ?? EXPECTED.wsol }
    }
  };
}
const build = (rs, opts = {}) => core.buildLedger(rs, { mint: MINT, ...opts });
const pages = (...ps) => {
  let i = 0;
  return async () => ({ ok: true, status: 200, text: async () => JSON.stringify(ps[Math.min(i++, ps.length - 1)]) });
};

test('delivered uses net settled USD only (fees excluded); toys floor once after summing', () => {
  const s = core.summarize(build([receipt({ net: '12500000', fee: '3125000' }), receipt({ net: '12500000', fee: '3125000' })]).ledger);
  assert.equal(s.netUsdE6, '25000000');
  assert.equal(s.feeUsdE6, '6250000');
  assert.equal(s.toys, '1');                 // $25 → 1 toy; per-receipt floors would give 0
});

test('price is not an input: counted toys never move with SOL', () => {
  const rs = [receipt({ net: '250000000' })];
  assert.equal(core.summarize(build(rs).ledger).toys, '10');
});

test('pending / unsettled receipts are rejected, not counted', () => {
  assert.throws(() => build([receipt({ status: 'pending' })]), core.RefreshRejected);
  assert.throws(() => build([receipt({ parentStatus: 'processing' })]), core.RefreshRejected);
});

test('receipts of other coins are skipped; nothing counts before launch (no mint)', () => {
  const { ledger, unrelated } = build([receipt({ mint: 'FVfB5e7kDvxUtMsAJ1LARAHRdTVZvbcJA1qvRQv3pump' }), receipt()]);
  assert.equal(ledger.size, 1);
  assert.equal(unrelated, 1);
  assert.equal(core.buildLedger([receipt()], { mint: null }).ledger.size, 0);
});

test('donation config: enforced when known (on-chain or pinned), free when unknown', () => {
  assert.throws(() => build([receipt({ configId: '0xdead' })], { configIds: new Set([CFG]) }), /unexpected donation config/);
  assert.equal(build([receipt({ configId: CFG.toUpperCase().replace('0X', '0x') })], { configIds: new Set([CFG]) }).ledger.size, 1);
  assert.equal(build([receipt({ configId: '0xanything' })]).ledger.size, 1);
});

test('inconsistent $TOY receipts reject the refresh', () => {
  for (const bad of [{ source: 'SomeOtherProgram111111111111111111111111111' }, { charityId: 'other' },
    { usdc: 'So11111111111111111111111111111111111111112' }, { decimals: 9 }, { input: EXPECTED.usdc },
    { gross: '99' }, { net: '1.5' }, { transactionLog: { txHash: '', blockNumber: '1', blockTimestamp: '2026-11-15T03:57:10.000Z' } },
    { transactionLog: { txHash: TX, blockNumber: 'x', blockTimestamp: '2026-11-15T03:57:10.000Z' } },
    { transactionLog: { txHash: TX, blockNumber: '5', blockTimestamp: 'not a date' } }]) {
    assert.throws(() => build([receipt(bad)]), core.RefreshRejected, JSON.stringify(bad));
  }
});

test('batched receipts sharing one tx are each counted (dedupe by receipt id, not tx)', () => {
  const s = core.summarize(build([receipt({ tx: TX }), receipt({ tx: TX }), receipt({ tx: TX })]).ledger);
  assert.equal(s.receipts, 3);
  assert.equal(s.transactions, 1);
});

test('identical repeats are ignored, conflicting duplicates rejected', () => {
  const a = receipt({ id: 'dup' });
  assert.equal(build([a, JSON.parse(JSON.stringify(a))]).ledger.size, 1);
  assert.throws(() => build([receipt({ id: 'dup2', net: '1000' }), receipt({ id: 'dup2', net: '2000' })]), /conflicting duplicate/);
});

test('committed history must stay present and unchanged', () => {
  const a = receipt({ id: 'h1' }), b = receipt({ id: 'h2' });
  const committed = build([a, b]).ledger;
  assert.throws(() => build([a], { committed }), /missing/);
  const altered = JSON.parse(JSON.stringify(b)); altered.usdNetE6 = altered.settledNetAtomic = '7000000';
  altered.usdGrossE6 = altered.settledGrossAtomic = '9000000';
  assert.throws(() => build([a, altered], { committed }), /changed/);
  assert.equal(build([a, b, receipt()], { committed }).ledger.size, 3);
});

test('recent settlements are newest first and capped', () => {
  const rs = Array.from({ length: 12 }, (_, i) => receipt({ at: new Date(Date.UTC(2026, 10, 1 + i)).toISOString() }));
  const s = core.summarize(build(rs).ledger);
  assert.equal(s.recent.length, 8);
  assert.ok(Date.parse(s.recent[0].at) > Date.parse(s.recent[1].at));
  assert.equal(s.lastSettlement.at, s.recent[0].at);
});

test('snapshot JSON round-trips exactly', () => {
  const l = build([receipt(), receipt()]).ledger;
  const back = core.ledgerFromJson(JSON.parse(JSON.stringify(core.ledgerToJson(l))));
  assert.deepEqual(core.summarize(back), core.summarize(l));
});

test('pagination reads every page', async () => {
  const rs = await core.fetchAllReceipts(pages({ pageKey: 'p2', response: [receipt()] }, { pageKey: null, response: [receipt()] }));
  assert.equal(rs.length, 2);
});

test('pagination failures reject: repeated cursor, malformed page, HTTP error, runaway', async () => {
  await assert.rejects(core.fetchAllReceipts(pages({ pageKey: 'same', response: [] }, { pageKey: 'same', response: [] })), /repeated/);
  await assert.rejects(core.fetchAllReceipts(pages({ nope: true })), /malformed/);
  await assert.rejects(core.fetchAllReceipts(async () => ({ ok: false, status: 500, text: async () => '' })), core.RefreshRejected);
  let k = 0;
  await assert.rejects(core.fetchAllReceipts(async () => ({ ok: true, text: async () => JSON.stringify({ pageKey: 'c' + k++, response: [] }) }), { maxPages: 5 }), /safety limit/);
});

test('RPC failover: second provider answers when the first fails; URLs are redacted in errors', async () => {
  const calls = [];
  const rpc = core.makeRpc(async url => {
    calls.push(url);
    if (url.includes('primary')) throw new Error('down https://primary.example/?api-key=SECRET');
    return { ok: true, text: async () => JSON.stringify({ result: 42 }) };
  }, ['https://primary.example/?api-key=SECRET', 'https://backup.example']);
  assert.equal(await rpc('getSlot', []), 42);
  assert.deepEqual(calls, ['https://primary.example/?api-key=SECRET', 'https://backup.example']);
  const dead = core.makeRpc(async () => { throw new Error('boom https://x.example/?api-key=SECRET'); }, ['https://x.example/?api-key=SECRET']);
  await assert.rejects(dead('getSlot', []), e => !String(e.message).includes('SECRET'));
});

test('derived accounts match the known on-chain addresses (verified on a live charity coin)', async () => {
  const a = await core.deriveAccounts(MINT);
  assert.equal(a.sharing, 'CY4uPHpN7bJC5oS6YjBXQTgfyWEyuoMEjuAGyUijN5FV');
  assert.equal(a.curveVault, '2ZUACvRzvBXdenPkgxdo69ywhv7BmYqpvUYrig6Kqj2d');
  assert.equal(a.ammVault, '9E8GAvZYdxRezXDKp3KjWCAyjYhyFPJnaD11E7DiboZ8');
});

test('bundled snapshot is valid and self-consistent', () => {
  const snap = require('../_data/settled-snapshot.json');
  const s = core.summarize(core.ledgerFromJson(snap.receipts));
  assert.equal(BigInt(s.grossUsdE6), BigInt(s.netUsdE6) + BigInt(s.feeUsdE6) + BigInt(s.tipUsdE6));
});
