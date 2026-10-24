import evidence from './evidence.json' with { type: 'json' }
import deployments from '../deployments.json' with { type: 'json' }
const lastRun = evidence.run

// One frozen, completed run: captured from the dashboard's lastRun.json.
// Keep its manifest in the snapshot so later live runs cannot mix into this recording.
// evidence.json was captured from the configured contracts using scripts/capture-story.mjs.
// Never use current prices/positions alongside historical payouts. USD is rounded to cents.
const WAD = 10n ** 18n
const cents = (wad: bigint) => Number((wad * 100n + WAD / 2n) / WAD)
const required = <T,>(value: T | undefined, label: string): T => {
  if (value === undefined) throw new Error(`Story evidence missing: ${label}`)
  return value
}
const event = (name: string, user?: string) => required(evidence.events.find(e =>
  e.event === name && (!user || e.args.user?.toLowerCase() === user.toLowerCase())), name)
const prices = evidence.events.filter(e => e.event === 'PriceSet')
const reset = required(prices[0], 'reset price')
const crash = required(prices[1], 'crash price')
const fair = event('Liquidated', deployments.borrowerFair)
const fixed = event('Liquidated', deployments.borrowerFixed)
const flag = event('Flagged', deployments.borrowerFair)
const priceBefore = BigInt(required(reset.args.price, 'initial price'))
const priceAfter = BigInt(required(crash.args.price, 'crash price'))
const collateral = BigInt(evidence.positions.fair[0])
const debt = cents(BigInt(evidence.positions.fair[1]))
const total = cents(collateral * priceAfter / WAD)
const payout = (e: typeof fair) => {
  const keep = cents(BigInt(required(e.args.toBorrower, 'borrower payout')) * priceAfter / WAD)
  // Deriving bonus as the residual after rounding guarantees displayed cents reconcile.
  return { keep, bonus: total - debt - keep, premiumBps: Number(e.args.premiumBps), tx: e.tx }
}
const flagBlock = Number(flag.block)
const winBlock = Number(fair.block)
const blockTimes = evidence.blocks.map(b => ({ block: Number(b.number), timestamp: Number(b.timestamp), hash: b.hash }))
const flagTime = required(blockTimes.find(b => b.block === flagBlock), 'flag timestamp').timestamp
const winTime = required(blockTimes.find(b => b.block === winBlock), 'winning timestamp').timestamp
const attempts = lastRun.transactions.filter(t => t.label.startsWith('fair-liquidate')).map(t => {
  const receipt = required(evidence.receipts.find(r => r.hash === t.tx), 'attempt receipt')
  if (receipt.status !== t.status || receipt.block !== t.block) throw new Error('Story receipt mismatch')
  return { bot: t.bot, block: Number(t.block), hash: t.tx, won: t.tx === fair.tx, status: receipt.status }
})
if (evidence.chainId !== deployments.chainId || evidence.deployments.fairLend.toLowerCase() !== deployments.fairLend.toLowerCase()) throw new Error('Story deployment mismatch')
if (evidence.positions.fixed[0] !== evidence.positions.fair[0] || evidence.positions.fixed[1] !== evidence.positions.fair[1]) throw new Error('Comparison requires identical loans')
if (!lastRun.transactions.some(t => t.tx === fair.tx) || flagBlock >= winBlock) throw new Error('Story run mismatch')

export const storyData = {
  chainId: evidence.chainId,
  capturedAt: evidence.capturedAt,
  collateralEth: Number(collateral) / Number(WAD),
  debt, total,
  initialTotal: cents(collateral * priceBefore / WAD),
  priceBefore: cents(priceBefore), priceAfter: cents(priceAfter),
  fixed: payout(fixed), fair: payout(fair),
  flagBlock, winBlock, endBlock: Math.max(...attempts.map(a => a.block)),
  stepBps: Number(evidence.stepBps), thresholdPct: Number(evidence.thresholdPct),
  winner: required(attempts.find(a => a.won), 'winner').bot,
  blocks: winBlock - flagBlock,
  elapsedSeconds: winTime - flagTime,
  blockTimes: blockTimes.filter(b => b.block <= winBlock),
  attempts,
  transactions: { reset: reset.tx, crash: crash.tx, flag: flag.tx, fixed: fixed.tx, fair: fair.tx },
  // Explicit counterfactual, NOT a transaction on Ethereum. Assumes no missed slots.
  // Source: ethereum.org/developers/docs/consensus-mechanisms/pos/ (12-second slots).
  ethereumStepSeconds: 12,
}
export const money = (value: number) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: value % 100 === 0 ? 0 : 2,
}).format(value / 100)
export const percent = (bps: number) => `${bps / 100}%`
export const ratio = (storyData.fair.keep / storyData.fixed.keep).toFixed(1)
