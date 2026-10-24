import { useSyncExternalStore } from 'react'
import type { Abi, PublicClient } from 'viem'
import oracleAbi from './abi/AdminOracle.json'
import fairLendAbi from './abi/FairLend.json'
import { makeHttpClient, makePublicClient } from './chain.ts'
import deployments from './deployments.json'
import {
  backfill,
  blockTime,
  buildView,
  fetchEvents,
  pickSegment,
  scanBlock,
  scanWindow,
  segments,
  type Attempt,
  type ChainEvent,
  type Config,
  type Hex,
  type Position,
  type RunView,
} from './run.ts'

export const cfg: Config = {
  fairLend: deployments.fairLend as Hex,
  oracle: deployments.oracle as Hex,
  borrowerFixed: deployments.borrowerFixed as Hex,
  borrowerFair: deployments.borrowerFair as Hex,
  bots: deployments.bots as Hex[],
  abi: [...fairLendAbi, ...oracleAbi] as Abi,
}

export type Connection = 'connecting' | 'live' | 'error'

export type Snapshot = {
  connection: Connection
  error?: string
  head?: number
  /** Oracle price right now (USD); the run's own prices are in view. */
  oraclePrice?: number
  view?: RunView
}

const BLOCK_TIME_SPAN = 200
const MAX_SCAN_PER_TICK = 6
const SCAN_PARALLEL = 2
const MIN_TICK_MS = 1000
/** A run that never settles (bots off) is only tx-scanned over its newest blocks. */
const MAX_SCAN_WINDOW = 300

const st = {
  events: [] as ChainEvent[],
  seen: new Set<string>(),
  logsTo: 0,
  head: 0,
  oraclePrice: undefined as bigint | undefined,
  posFixed: undefined as Position | undefined,
  posFair: undefined as Position | undefined,
  attempts: new Map<Hex, Attempt>(),
  scanned: new Set<number>(),
  blockTimeS: new Map<number, number>(),
}

let snap: Snapshot = { connection: 'connecting' }
const listeners = new Set<() => void>()

function emit(next: Partial<Snapshot>) {
  snap = { ...snap, ...next }
  for (const l of listeners) l()
}

function errText(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e)
  return msg.split('\n')[0].slice(0, 160)
}

function addEvents(list: ChainEvent[]) {
  let added = false
  for (const e of list) {
    const key = `${e.tx}:${e.index}`
    if (st.seen.has(key)) continue
    st.seen.add(key)
    st.events.push(e)
    added = true
  }
  return added
}

async function readState(client: PublicClient) {
  const [price, fixed, fair] = await Promise.all([
    client.readContract({ address: cfg.oracle, abi: cfg.abi, functionName: 'price' }),
    client.readContract({ address: cfg.fairLend, abi: cfg.abi, functionName: 'positions', args: [cfg.borrowerFixed] }),
    client.readContract({ address: cfg.fairLend, abi: cfg.abi, functionName: 'positions', args: [cfg.borrowerFair] }),
  ])
  const pos = (t: unknown): Position => {
    const [collateral, debt, mode, startBlock] = t as [bigint, bigint, number, bigint]
    return { collateral, debt, mode: Number(mode), startBlock }
  }
  st.oraclePrice = price as bigint
  st.posFixed = pos(fixed)
  st.posFair = pos(fair)
}

async function tick(client: PublicClient, head: number) {
  st.head = Math.max(st.head, head)

  // 1) new logs since the last tick (100-block chunks); first tick walks back to the last run
  let changed = false
  if (st.logsTo === 0) {
    changed = addEvents((await backfill(client, cfg, st.head)).events)
    st.logsTo = st.head
  }
  while (st.logsTo < st.head) {
    const from = st.logsTo + 1
    const to = Math.min(st.head, from + 99)
    changed = addEvents(await fetchEvents(client, cfg, from, to)) || changed
    st.logsTo = to
  }
  if (changed || st.oraclePrice == null) await readState(client)

  // 2) bot transactions inside the displayed run's window
  const { seg } = pickSegment(segments(st.events, cfg))
  if (seg?.crash) {
    const [start, to] = scanWindow(seg, st.head)!
    const from = Math.max(start, to - MAX_SCAN_WINDOW)
    const todo: number[] = []
    for (let n = from; n <= to && todo.length < MAX_SCAN_PER_TICK; n++) {
      if (!st.scanned.has(n)) todo.push(n)
    }
    for (let i = 0; i < todo.length; i += SCAN_PARALLEL) {
      const batch = todo.slice(i, i + SCAN_PARALLEL)
      const results = await Promise.all(batch.map((n) => scanBlock(client, cfg, n)))
      batch.forEach((n) => st.scanned.add(n))
      for (const a of results.flat()) st.attempts.set(a.hash, a)
    }
    // 3) average block time around this run, measured once it is settled
    if (seg.liqFair && !st.blockTimeS.has(seg.crash.block)) {
      const s = await blockTime(client, seg.crash.block - BLOCK_TIME_SPAN, seg.liqFair.block)
      if (s != null) st.blockTimeS.set(seg.crash.block, s)
    }
  }
}

/** Newest head from the subscription. Moves the chart and block counter without any RPC call. */
let liveHead = 0

function render(extra: Partial<Snapshot> = {}) {
  const { seg, latest } = pickSegment(segments(st.events, cfg))
  const head = Math.max(st.head, liveHead)
  emit({
    ...extra,
    head,
    oraclePrice: st.oraclePrice != null ? Number(st.oraclePrice / 10n ** 14n) / 10_000 : undefined,
    view:
      seg?.crash &&
      buildView({
        cfg,
        seg,
        latest,
        head,
        attempts: [...st.attempts.values()],
        blockTimeS: st.blockTimeS.get(seg.crash.block),
        posFixed: st.posFixed,
        posFair: st.posFair,
      }),
  })
}

// RPC work (logs, block scans) runs at most once per MIN_TICK_MS and never overlaps;
// heads that arrive meanwhile are folded into the next tick. Keeps us under public RPC rate limits.
let ticking = false
let timer: ReturnType<typeof setTimeout> | undefined
let lastTick = 0

function schedule(client: PublicClient) {
  if (ticking || timer) return
  timer = setTimeout(async () => {
    timer = undefined
    ticking = true
    lastTick = Date.now()
    try {
      await tick(client, liveHead)
      render({ connection: 'live', error: undefined })
    } catch (e) {
      // Keep whatever run is already on screen; the banner says it is not live.
      emit({ connection: 'error', error: errText(e) })
    } finally {
      ticking = false
    }
    if (liveHead > st.head) schedule(client)
  }, Math.max(0, lastTick + MIN_TICK_MS - Date.now()))
}

function onHead(client: PublicClient, head: number) {
  liveHead = Math.max(liveHead, head)
  if (st.logsTo > 0) render()
  if (liveHead > st.head || snap.connection !== 'live') schedule(client)
}

async function start() {
  const client = makeHttpClient() as PublicClient
  try {
    onHead(client, Number(await client.getBlockNumber()))
  } catch (e) {
    emit({ connection: 'error', error: errText(e) })
  }

  const watcher = makePublicClient() as PublicClient
  watcher.watchBlockNumber({
    emitMissed: false,
    pollingInterval: 500,
    onBlockNumber: (n) => onHead(client, Number(n)),
    onError: (e) => emit({ connection: 'error', error: errText(e) }),
  })
}

let started = false

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!started && typeof window !== 'undefined') {
    started = true
    void start()
  }
  return () => {
    listeners.delete(listener)
  }
}

export function useRun(): Snapshot {
  return useSyncExternalStore(subscribe, () => snap, () => snap)
}
