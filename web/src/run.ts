import {
  decodeErrorResult,
  decodeFunctionData,
  type Abi,
  type PublicClient,
} from 'viem'
import lastRun from './lastRun.json'

/**
 * Chain → run model, framework-free. Everything shown on screen is derived from
 * PriceSet / Flagged / Liquidated logs, bot transactions to FairLend, their receipts,
 * revert data (debug_traceTransaction) and block timestamps.
 *
 * A "run" is the stretch between two resetDemo() calls (PriceSet == RESET_PRICE).
 * Its start block is the crash PriceSet; both sides are measured from that block.
 */

export type Hex = `0x${string}`

export type Config = {
  fairLend: Hex
  oracle: Hex
  borrowerFixed: Hex
  borrowerFair: Hex
  bots: readonly Hex[]
  abi: Abi
}

export const RESET_PRICE = 3000n * 10n ** 18n
export const CRASH_PRICE = 2300n * 10n ** 18n
export const STEP_BPS = 50
export const CAP_BPS = 1000
export const FIXED_BPS = 1000
export const ETH_BLOCK_S = 12
export const BOT_NAMES = ['A', 'B', 'C'] as const
const WAD = 10n ** 18n
const LOG_CHUNK = 100 // Monad RPCs cap eth_getLogs at 100 blocks
const MAX_LOG_CHUNKS = 120
const PARALLEL_CHUNKS = 4
/** Fallback walk from lastRun.json: reset happens ~40 blocks before the crash. */
const LAST_RUN_CHUNKS = 12
/** Blocks scanned after the winning tx so late losers still show up. */
export const AFTER_WIN_BLOCKS = 8

type Base = { block: number; index: number; tx: Hex }
export type PriceEvent = Base & { kind: 'price'; price: bigint }
export type FlagEvent = Base & { kind: 'flag'; user: Hex; startBlock: number }
export type LiqEvent = Base & {
  kind: 'liq'
  user: Hex
  liquidator: Hex
  premiumBps: number
  toLiquidator: bigint
  toBorrower: bigint
}
export type ChainEvent = PriceEvent | FlagEvent | LiqEvent

export type Attempt = {
  hash: Hex
  block: number
  index: number
  bot: number
  fn: string
  user?: Hex
  ok: boolean
  /** Decoded custom error name from the revert data, when the RPC can trace. */
  error?: string
}

export type Segment = {
  reset: PriceEvent
  /** Block of the next reset, if any. */
  nextReset?: number
  crash?: PriceEvent
  flag?: FlagEvent
  liqFixed?: LiqEvent
  liqFair?: LiqEvent
}

export type Position = { collateral: bigint; debt: bigint; mode: number; startBlock: bigint }

const same = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase()
const order = (a: { block: number; index: number }, b: { block: number; index: number }) => a.block - b.block || a.index - b.index

// --- logs ---

export async function fetchEvents(
  client: PublicClient,
  cfg: Config,
  fromBlock: number,
  toBlock: number,
): Promise<ChainEvent[]> {
  const logs = await client.getLogs({
    address: [cfg.fairLend, cfg.oracle],
    events: cfg.abi.filter(
      (x) => x.type === 'event' && ['PriceSet', 'Flagged', 'Liquidated'].includes(x.name),
    ) as never,
    fromBlock: BigInt(fromBlock),
    toBlock: BigInt(toBlock),
  })
  const out: ChainEvent[] = []
  for (const log of logs as unknown as {
    address: Hex
    eventName: string
    args: Record<string, unknown>
    blockNumber: bigint | null
    logIndex: number | null
    transactionHash: Hex | null
  }[]) {
    if (log.blockNumber == null || log.transactionHash == null) continue
    const base = { block: Number(log.blockNumber), index: log.logIndex ?? 0, tx: log.transactionHash }
    const a = log.args
    if (log.eventName === 'PriceSet' && same(log.address, cfg.oracle)) {
      out.push({ ...base, kind: 'price', price: a.price as bigint })
    } else if (log.eventName === 'Flagged' && same(log.address, cfg.fairLend)) {
      out.push({ ...base, kind: 'flag', user: a.user as Hex, startBlock: Number(a.startBlock) })
    } else if (log.eventName === 'Liquidated' && same(log.address, cfg.fairLend)) {
      out.push({
        ...base,
        kind: 'liq',
        user: a.user as Hex,
        liquidator: a.liquidator as Hex,
        premiumBps: Number(a.premiumBps),
        toLiquidator: a.toLiquidator as bigint,
        toBorrower: a.toBorrower as bigint,
      })
    }
  }
  return out
}

export function segments(events: ChainEvent[], cfg: Config): Segment[] {
  const sorted = [...events].sort(order)
  const segs: Segment[] = []
  for (const e of sorted) {
    if (e.kind === 'price' && e.price === RESET_PRICE) {
      const prev = segs.at(-1)
      if (prev) prev.nextReset = e.block
      segs.push({ reset: e })
      continue
    }
    const seg = segs.at(-1)
    if (!seg) continue
    if (e.kind === 'price') {
      if (!seg.crash && e.price < seg.reset.price) seg.crash = e
    } else if (e.kind === 'flag') {
      if (!seg.flag && same(e.user, cfg.borrowerFair)) seg.flag = e
    } else if (seg.crash) {
      if (!seg.liqFixed && same(e.user, cfg.borrowerFixed)) seg.liqFixed = e
      if (!seg.liqFair && same(e.user, cfg.borrowerFair)) seg.liqFair = e
    }
  }
  return segs
}

/** Latest segment if it has a crash, otherwise the newest earlier one that does. */
export function pickSegment(segs: Segment[]): { seg?: Segment; latest: boolean } {
  const last = segs.at(-1)
  if (last?.crash) return { seg: last, latest: true }
  for (let i = segs.length - 2; i >= 0; i--) {
    if (segs[i].crash) return { seg: segs[i], latest: false }
  }
  return { latest: false }
}

/**
 * Walks back from head until the run to display is fully covered (or the cap is hit).
 * If the last run is older than the cap, walks back again from lastRun.json (written by the bot).
 */
export async function backfill(client: PublicClient, cfg: Config, head: number) {
  const recent = await walkBack(client, cfg, head, MAX_LOG_CHUNKS)
  if (pickSegment(segments(recent.events, cfg)).seg) return recent
  const hintTo = Number(lastRun.toBlock) + AFTER_WIN_BLOCKS
  if (!(hintTo < recent.scannedFrom)) return recent
  const old = await walkBack(client, cfg, hintTo, LAST_RUN_CHUNKS)
  return { events: [...old.events, ...recent.events], scannedFrom: old.scannedFrom }
}

async function walkBack(client: PublicClient, cfg: Config, head: number, maxChunks: number) {
  const events: ChainEvent[] = []
  let from = head + 1
  for (let i = 0; i < maxChunks && from > 0; i += PARALLEL_CHUNKS) {
    const ranges: [number, number][] = []
    for (let k = 0; k < PARALLEL_CHUNKS && from > 0; k++) {
      const to = from - 1
      from = Math.max(0, to - LOG_CHUNK + 1)
      ranges.push([from, to])
    }
    const parts = await Promise.all(ranges.map(([f, t]) => fetchEvents(client, cfg, f, t)))
    events.push(...parts.flat())
    const segs = segments(events, cfg)
    // segments() drops events before the oldest reset, so a segment present here starts at its reset.
    if (pickSegment(segs).seg) break
  }
  return { events, scannedFrom: from }
}

// --- bot transactions ---

export function scanWindow(seg: Segment, head: number): [number, number] | undefined {
  if (!seg.crash) return undefined
  const settled = Math.max(seg.liqFair?.block ?? 0, seg.liqFixed?.block ?? 0)
  let end = seg.liqFair ? settled + AFTER_WIN_BLOCKS : head
  if (seg.nextReset != null) end = Math.min(end, seg.nextReset - 1)
  return [seg.crash.block, Math.min(end, head)]
}

type RawTx = { hash: Hex; from: Hex; to: Hex | null; input: Hex; transactionIndex: number | null }

async function traceError(client: PublicClient, cfg: Config, hash: Hex): Promise<string | undefined> {
  try {
    const trace = (await (client.request as unknown as (a: {
      method: string
      params: unknown[]
    }) => Promise<{ output?: Hex }>)({
      method: 'debug_traceTransaction',
      params: [hash, { tracer: 'callTracer' }],
    })) ?? {}
    if (!trace.output || trace.output === '0x') return undefined
    return decodeErrorResult({ abi: cfg.abi, data: trace.output }).errorName
  } catch {
    return undefined
  }
}

/** Seconds per block between two blocks, from their timestamps. */
export async function blockTime(client: PublicClient, from: number, to: number): Promise<number | undefined> {
  if (to <= from) return undefined
  const [a, b] = await Promise.all([
    client.getBlock({ blockNumber: BigInt(from) }),
    client.getBlock({ blockNumber: BigInt(to) }),
  ])
  return Number(b.timestamp - a.timestamp) / (to - from)
}

export async function scanBlock(client: PublicClient, cfg: Config, n: number) {
  const block = await client.getBlock({ blockNumber: BigInt(n), includeTransactions: true })
  const ours = (block.transactions as unknown as RawTx[]).filter(
    (tx) => same(tx.to ?? undefined, cfg.fairLend) && cfg.bots.some((b) => same(b, tx.from)),
  )
  const attempts = await Promise.all(
    ours.map(async (tx): Promise<Attempt> => {
      let fn = 'call'
      let user: Hex | undefined
      try {
        const d = decodeFunctionData({ abi: cfg.abi, data: tx.input })
        fn = d.functionName
        user = (d.args as readonly unknown[] | undefined)?.[0] as Hex | undefined
      } catch {
        /* not a FairLend call we know */
      }
      const receipt = await client.getTransactionReceipt({ hash: tx.hash })
      const ok = receipt.status === 'success'
      return {
        hash: tx.hash,
        block: n,
        index: tx.transactionIndex ?? 0,
        bot: cfg.bots.findIndex((b) => same(b, tx.from)),
        fn,
        user,
        ok,
        error: ok ? undefined : await traceError(client, cfg, tx.hash),
      }
    }),
  )
  return attempts
}

// --- view ---

export type Phase = 'empty' | 'idle' | 'running' | 'settled'

export type SideView = {
  premiumBps: number
  /** USD the borrower gets back; null when collateral/debt are unknown. */
  keepUsd: number | null
  /** USD of collateral paid to the liquidator above the debt. */
  bonusUsd: number | null
  liq?: LiqEvent
  /** True when keepUsd comes from a Liquidated event, false when it is the live/projected value. */
  settled: boolean
}

export type AttemptView = Attempt & {
  side: 'fixed' | 'fair' | null
  /** Premium in effect in the attempt's block (event value for winners). */
  premiumBps: number | null
  won: boolean
  reason?: string
}

export type RunView = {
  phase: Phase
  priceBefore: number
  priceAfter: number
  crashBlock: number
  flagBlock?: number
  /** Last block drawn on the chart. */
  endBlock: number
  fixed: SideView
  fair: SideView
  attempts: AttemptView[]
  auction?: { blocks: number; seconds: number | null }
  blockTimeS?: number
}

const usd = (wad: bigint) => Number(wad / 10n ** 14n) / 10_000

export function premiumAt(flagBlock: number | undefined, block: number): number {
  if (flagBlock == null || block < flagBlock) return 0
  return Math.min(CAP_BPS, (block - flagBlock) * STEP_BPS)
}

function fromEvent(liq: LiqEvent, price: bigint): SideView {
  const liqValue = (liq.toLiquidator * price) / WAD
  // debt = toLiquidator·price / (1 + premium) unless the payout hit the collateral cap
  const debt = (liqValue * 10_000n) / BigInt(10_000 + liq.premiumBps)
  return {
    premiumBps: liq.premiumBps,
    keepUsd: usd((liq.toBorrower * price) / WAD),
    bonusUsd: usd(liqValue - debt),
    liq,
    settled: true,
  }
}

function projected(premiumBps: number, price: bigint, pos?: { collateral: bigint; debt: bigint }): SideView {
  if (!pos || pos.collateral === 0n || price === 0n) {
    return { premiumBps, keepUsd: null, bonusUsd: null, settled: false }
  }
  let toLiq = (((pos.debt * BigInt(10_000 + premiumBps)) / 10_000n) * WAD) / price
  if (toLiq > pos.collateral) toLiq = pos.collateral
  return {
    premiumBps,
    keepUsd: usd(((pos.collateral - toLiq) * price) / WAD),
    bonusUsd: usd((toLiq * price) / WAD - pos.debt),
    settled: false,
  }
}

function reasonFor(
  a: Attempt,
  side: 'fixed' | 'fair' | null,
  seg: Segment,
  txIndex: Map<Hex, number>,
): string | undefined {
  if (a.ok || !a.error) return undefined
  const win = side === 'fixed' ? seg.liqFixed : side === 'fair' ? seg.liqFair : undefined
  const before =
    !!win && (win.block < a.block || (win.block === a.block && (txIndex.get(win.tx) ?? -1) < a.index))
  if (a.error === 'Healthy' && before) return 'already liquidated'
  if (a.error === 'Healthy') return 'position healthy'
  if (a.error === 'NotFlagged') return 'not flagged yet'
  if (a.error === 'AlreadyFlagged') return 'already flagged'
  return a.error
}

export function buildView(input: {
  cfg: Config
  seg: Segment
  latest: boolean
  head: number
  attempts: Attempt[]
  /** Average seconds per block measured from block timestamps around the run. */
  blockTimeS?: number
  /** Current positions; only used when the segment is the latest one. */
  posFixed?: Position
  posFair?: Position
}): RunView {
  const { cfg, seg, latest, head } = input
  const crash = seg.crash!
  const price = crash.price
  const flagBlock = seg.flag?.startBlock
  const [from, to] = scanWindow(seg, head) ?? [crash.block, head]

  // Collateral/debt for projections: live position, else what a settled side implies.
  const implied = (liq?: LiqEvent) =>
    liq && {
      collateral: liq.toLiquidator + liq.toBorrower,
      debt: (((liq.toLiquidator * price) / WAD) * 10_000n) / BigInt(10_000 + liq.premiumBps),
    }
  const open = (p?: Position) => (latest && p && p.collateral > 0n ? p : undefined)
  const shape = open(input.posFixed) ?? open(input.posFair) ?? implied(seg.liqFair) ?? implied(seg.liqFixed)

  const fixed = seg.liqFixed ? fromEvent(seg.liqFixed, price) : projected(FIXED_BPS, price, open(input.posFixed) ?? shape)
  const fair = seg.liqFair
    ? fromEvent(seg.liqFair, price)
    : projected(premiumAt(flagBlock, head), price, open(input.posFair) ?? shape)

  const txIndex = new Map(input.attempts.map((a) => [a.hash, a.index]))
  const attempts = input.attempts
    .filter((a) => a.block >= from && a.block <= to)
    .sort(order)
    .map((a): AttemptView => {
      const side = same(a.user, cfg.borrowerFixed) ? 'fixed' : same(a.user, cfg.borrowerFair) ? 'fair' : null
      const won = (side === 'fixed' && a.hash === seg.liqFixed?.tx) || (side === 'fair' && a.hash === seg.liqFair?.tx)
      const premiumBps =
        a.fn !== 'liquidate'
          ? null
          : won
            ? (side === 'fixed' ? seg.liqFixed : seg.liqFair)!.premiumBps
            : side === 'fixed'
              ? FIXED_BPS
              : premiumAt(flagBlock, a.block)
      return { ...a, side, premiumBps, won, reason: reasonFor(a, side, seg, txIndex) }
    })

  // Monad timestamps are whole seconds, so a 4-block auction would read as 1 s or 2 s.
  // Use the average block time measured over a longer span of the same chain instead.
  let auction: RunView['auction']
  if (seg.liqFair && flagBlock != null) {
    const blocks = seg.liqFair.block - flagBlock
    auction = { blocks, seconds: input.blockTimeS != null ? blocks * input.blockTimeS : null }
  }

  const lastAttempt = attempts.at(-1)?.block ?? 0
  return {
    phase: !latest ? 'idle' : seg.liqFair ? 'settled' : 'running',
    priceBefore: usd(seg.reset.price),
    priceAfter: usd(price),
    crashBlock: crash.block,
    flagBlock,
    endBlock: seg.liqFair ? Math.max(seg.liqFair.block, lastAttempt) : head,
    fixed,
    fair,
    attempts,
    auction,
    blockTimeS: input.blockTimeS,
  }
}
