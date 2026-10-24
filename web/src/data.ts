import { useSyncExternalStore } from 'react'
import { formatUnits } from 'viem'
import { abi } from './abi.ts'
import { makeHttpClient, makePublicClient } from './chain.ts'
import deployments from './deployments.json'
import mockDeployments from './deployments.mock.json'

export const USE_MOCK = !import.meta.env.VITE_FAIRLEND

export type BotName = 'A' | 'B' | 'C'
export type Connection = 'mock' | 'connecting' | 'live' | 'error'

export type Liquidated = {
  liquidator: string
  botName: BotName
  premiumBps: number
  toLiquidatorEth: number
  toBorrowerEth: number
  blockNumber: number
  txHash: string
}

export type Side = {
  collateralEth: number
  debtUsd: number
  premiumBps: number
  flaggedAtBlock?: number
  liquidated?: Liquidated
}

export type Run = {
  price: number
  fixed: Side
  fair: Side
  connection: Connection
  error?: string
  blockNumber?: number
}

const COLLATERAL_ETH = 1
const DEBT_USD = 2000
const PRICE_START = 3000
const PRICE_CRASH = 2300
export const STEP_BPS = 50
const CAP_BPS = 1000
const FIXED_BPS = 1000
export const FAIR_LIQ_BPS = 150
export const BLOCK_MS = 400
const FLAG_BLOCK = 1_000_000
const LOG_CHUNK = 100n
const MAX_LOG_CHUNKS = 80
const RESET_PRICE = 3000n * 10n ** 18n

const MOCK_BOTS = mockDeployments.bots as [string, string, string]
const TX_FIXED =
  '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const TX_FAIR =
  '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

const liveAddr = {
  fairLend: deployments.fairLend as `0x${string}`,
  oracle: deployments.oracle as `0x${string}`,
  borrowerFixed: deployments.borrowerFixed as `0x${string}`,
  borrowerFair: deployments.borrowerFair as `0x${string}`,
  bots: deployments.bots as [`0x${string}`, `0x${string}`, `0x${string}`],
}

function split(premiumBps: number, price: number): {
  toLiquidatorEth: number
  toBorrowerEth: number
} {
  const toLiquidatorEth = Math.min(
    COLLATERAL_ETH,
    (DEBT_USD * (1 + premiumBps / 10_000)) / price,
  )
  return {
    toLiquidatorEth,
    toBorrowerEth: Math.max(0, COLLATERAL_ETH - toLiquidatorEth),
  }
}

function side(premiumBps: number, extra: Partial<Side> = {}): Side {
  return {
    collateralEth: COLLATERAL_ETH,
    debtUsd: DEBT_USD,
    premiumBps,
    ...extra,
  }
}

function healthy(connection: Connection): Run {
  return {
    price: PRICE_START,
    fixed: side(FIXED_BPS),
    fair: side(0),
    connection,
  }
}

function settle(
  premiumBps: number,
  botName: BotName,
  blockNumber: number,
  txHash: string,
): Liquidated {
  const { toLiquidatorEth, toBorrowerEth } = split(premiumBps, PRICE_CRASH)
  return {
    liquidator: MOCK_BOTS[botName === 'A' ? 0 : botName === 'B' ? 1 : 2],
    botName,
    premiumBps,
    toLiquidatorEth,
    toBorrowerEth,
    blockNumber,
    txHash,
  }
}

let mockRun: Run = healthy('mock')
const mockListeners = new Set<() => void>()
let tick: ReturnType<typeof setInterval> | null = null

function emitMock(next: Run) {
  mockRun = next
  for (const listener of mockListeners) listener()
}

function subMock(listener: () => void) {
  mockListeners.add(listener)
  return () => {
    mockListeners.delete(listener)
  }
}

export function triggerMockCrash(opts?: { immediate?: boolean }) {
  if (!USE_MOCK) return
  if (tick) {
    clearInterval(tick)
    tick = null
  }

  const crashedFixed = side(FIXED_BPS, {
    liquidated: settle(FIXED_BPS, 'A', FLAG_BLOCK, TX_FIXED),
  })

  if (opts?.immediate) {
    const blocks = FAIR_LIQ_BPS / STEP_BPS
    emitMock({
      price: PRICE_CRASH,
      fixed: crashedFixed,
      fair: side(FAIR_LIQ_BPS, {
        flaggedAtBlock: FLAG_BLOCK,
        liquidated: settle(FAIR_LIQ_BPS, 'A', FLAG_BLOCK + blocks, TX_FAIR),
      }),
      connection: 'mock',
    })
    return
  }

  emitMock({
    price: PRICE_CRASH,
    fixed: crashedFixed,
    fair: side(0, { flaggedAtBlock: FLAG_BLOCK }),
    connection: 'mock',
  })

  let blocksAfterFlag = 0
  tick = setInterval(() => {
    blocksAfterFlag += 1
    const premiumBps = Math.min(CAP_BPS, blocksAfterFlag * STEP_BPS)
    const blockNumber = FLAG_BLOCK + blocksAfterFlag

    if (premiumBps >= FAIR_LIQ_BPS) {
      emitMock({
        ...mockRun,
        fair: side(FAIR_LIQ_BPS, {
          flaggedAtBlock: FLAG_BLOCK,
          liquidated: settle(FAIR_LIQ_BPS, 'A', blockNumber, TX_FAIR),
        }),
      })
      if (tick) clearInterval(tick)
      tick = null
      return
    }

    emitMock({
      ...mockRun,
      fair: side(premiumBps, { flaggedAtBlock: FLAG_BLOCK }),
    })
  }, BLOCK_MS)
}

// --- live chain ---

type Pos = {
  collateral: bigint
  debt: bigint
  mode: number
  startBlock: bigint
}

type LiqLog = {
  user: `0x${string}`
  liquidator: `0x${string}`
  premiumBps: bigint
  toLiquidator: bigint
  toBorrower: bigint
  blockNumber: bigint
  txHash: `0x${string}`
}

type LiveState = {
  price: bigint
  blockNumber: bigint
  fixed: Pos
  fair: Pos
  liqFixed?: LiqLog
  liqFair?: LiqLog
  flagFair?: bigint
  connection: Connection
  error?: string
}

const emptyPos: Pos = { collateral: 0n, debt: 0n, mode: 0, startBlock: 0n }

let live: LiveState = {
  price: RESET_PRICE,
  blockNumber: 0n,
  fixed: emptyPos,
  fair: emptyPos,
  connection: 'connecting',
}
let liveRun: Run = { ...healthy('connecting'), price: 0 }
const liveListeners = new Set<() => void>()
let liveStarted = false
let unwatch: (() => void)[] = []

function emitLive() {
  liveRun = toRun(live)
  for (const listener of liveListeners) listener()
}

function subLive(listener: () => void) {
  liveListeners.add(listener)
  ensureLive()
  return () => {
    liveListeners.delete(listener)
  }
}

function dec(value: bigint) {
  return Number(formatUnits(value, 18))
}

function botName(liquidator: string): BotName {
  const i = liveAddr.bots.findIndex(
    (b) => b.toLowerCase() === liquidator.toLowerCase(),
  )
  return (['A', 'B', 'C'] as const)[i] ?? 'A'
}

function localPremium(pos: Pos, currentBlock: bigint): number {
  if (pos.mode === 1) return FIXED_BPS
  if (pos.mode !== 2 || pos.startBlock === 0n) return 0
  const bps = (currentBlock - pos.startBlock) * BigInt(STEP_BPS)
  return Number(bps < BigInt(CAP_BPS) ? bps : BigInt(CAP_BPS))
}

function toLiquidated(log: LiqLog): Liquidated {
  return {
    liquidator: log.liquidator,
    botName: botName(log.liquidator),
    premiumBps: Number(log.premiumBps),
    toLiquidatorEth: dec(log.toLiquidator),
    toBorrowerEth: dec(log.toBorrower),
    blockNumber: Number(log.blockNumber),
    txHash: log.txHash,
  }
}

function toSide(
  pos: Pos,
  liq: LiqLog | undefined,
  currentBlock: bigint,
  flagBlock?: bigint,
): Side {
  if (pos.collateral > 0n) {
    const start = pos.startBlock !== 0n ? pos.startBlock : flagBlock
    return {
      collateralEth: dec(pos.collateral),
      debtUsd: dec(pos.debt),
      premiumBps: localPremium({ ...pos, startBlock: start ?? 0n }, currentBlock),
      flaggedAtBlock: start && start !== 0n ? Number(start) : undefined,
    }
  }
  if (liq) {
    return {
      collateralEth: dec(liq.toLiquidator + liq.toBorrower),
      debtUsd: DEBT_USD,
      premiumBps: Number(liq.premiumBps),
      flaggedAtBlock: flagBlock && flagBlock !== 0n ? Number(flagBlock) : undefined,
      liquidated: toLiquidated(liq),
    }
  }
  return { collateralEth: 0, debtUsd: 0, premiumBps: 0 }
}

function toRun(state: LiveState): Run {
  return {
    price: dec(state.price),
    fixed: toSide(state.fixed, state.liqFixed, state.blockNumber),
    fair: toSide(state.fair, state.liqFair, state.blockNumber, state.flagFair),
    connection: state.connection,
    error: state.error,
    blockNumber: state.blockNumber === 0n ? undefined : Number(state.blockNumber),
  }
}

function asPos(tuple: readonly [bigint, bigint, number, bigint]): Pos {
  return {
    collateral: tuple[0],
    debt: tuple[1],
    mode: Number(tuple[2]),
    startBlock: tuple[3],
  }
}

function errText(e: unknown) {
  return e instanceof Error ? e.message : String(e)
}

function asLiq(log: {
  args: {
    user?: `0x${string}`
    liquidator?: `0x${string}`
    premiumBps?: bigint
    toLiquidator?: bigint
    toBorrower?: bigint
    blockNumber?: bigint
  }
  blockNumber: bigint | null
  transactionHash: `0x${string}` | null
}): LiqLog | undefined {
  if (!log.args.user || !log.args.liquidator || !log.transactionHash || log.blockNumber == null) {
    return undefined
  }
  return {
    user: log.args.user,
    liquidator: log.args.liquidator,
    premiumBps: log.args.premiumBps ?? 0n,
    toLiquidator: log.args.toLiquidator ?? 0n,
    toBorrower: log.args.toBorrower ?? 0n,
    blockNumber: log.args.blockNumber ?? log.blockNumber,
    txHash: log.transactionHash,
  }
}

/** Monad RPCs cap eth_getLogs at 100 blocks; walk newest → oldest. */
async function collectRunEvents(
  client: ReturnType<typeof makePublicClient>,
  head: bigint,
  needLiqFixed: boolean,
  needLiqFair: boolean,
  needFlag: boolean,
) {
  let liqFixed: LiqLog | undefined
  let liqFair: LiqLog | undefined
  let flagFair: bigint | undefined

  for (let i = 0; i < MAX_LOG_CHUNKS; i++) {
    const done =
      (!needLiqFixed || liqFixed) &&
      (!needLiqFair || liqFair) &&
      (!needFlag || flagFair)
    if (done) break

    const toBlock = head - BigInt(i) * LOG_CHUNK
    if (toBlock < 0n) break
    const fromBlock = toBlock + 1n >= LOG_CHUNK ? toBlock - (LOG_CHUNK - 1n) : 0n

    const wantLiq = (needLiqFixed && !liqFixed) || (needLiqFair && !liqFair)
    const wantFlag = needFlag && !flagFair
    const [liqs, flags] = await Promise.all([
      wantLiq
        ? client.getContractEvents({
            address: liveAddr.fairLend,
            abi,
            eventName: 'Liquidated',
            fromBlock,
            toBlock,
          })
        : Promise.resolve([]),
      wantFlag
        ? client.getContractEvents({
            address: liveAddr.fairLend,
            abi,
            eventName: 'Flagged',
            fromBlock,
            toBlock,
          })
        : Promise.resolve([]),
    ])

    for (const log of [...liqs].reverse()) {
      const row = asLiq(log)
      if (!row) continue
      if (!liqFixed && row.user.toLowerCase() === liveAddr.borrowerFixed.toLowerCase()) {
        liqFixed = row
      }
      if (!liqFair && row.user.toLowerCase() === liveAddr.borrowerFair.toLowerCase()) {
        liqFair = row
      }
    }
    for (const log of [...flags].reverse()) {
      if (flagFair) break
      if (log.args.user?.toLowerCase() === liveAddr.borrowerFair.toLowerCase()) {
        flagFair = log.args.startBlock ?? log.blockNumber ?? undefined
      }
    }
    if (fromBlock === 0n) break
  }

  return { liqFixed, liqFair, flagFair }
}

async function loadFrom(client: ReturnType<typeof makePublicClient>) {
  const head = await client.getBlockNumber()

  const [price, posFixed, posFair] = await Promise.all([
    client.readContract({
      address: liveAddr.oracle,
      abi,
      functionName: 'price',
    }),
    client.readContract({
      address: liveAddr.fairLend,
      abi,
      functionName: 'positions',
      args: [liveAddr.borrowerFixed],
    }),
    client.readContract({
      address: liveAddr.fairLend,
      abi,
      functionName: 'positions',
      args: [liveAddr.borrowerFair],
    }),
  ])

  const fixed = asPos(posFixed)
  const fairPos = asPos(posFair)
  const needLiqFixed = fixed.collateral === 0n
  const needLiqFair = fairPos.collateral === 0n

  const { liqFixed, liqFair, flagFair } = await collectRunEvents(
    client,
    head,
    needLiqFixed,
    needLiqFair,
    needLiqFair,
  )

  const fair = {
    ...fairPos,
    startBlock: fairPos.startBlock !== 0n ? fairPos.startBlock : (flagFair ?? 0n),
  }

  live = {
    price,
    blockNumber: head,
    fixed,
    fair,
    liqFixed,
    liqFair,
    flagFair: fair.startBlock !== 0n ? fair.startBlock : flagFair,
    connection: 'live',
    error: undefined,
  }
  emitLive()
}

function attachWatches(client: ReturnType<typeof makePublicClient>) {
  unwatch.forEach((u) => u())
  unwatch = []

  unwatch.push(
    client.watchContractEvent({
      address: liveAddr.oracle,
      abi,
      eventName: 'PriceSet',
      onLogs: async (logs: readonly { args: { price?: bigint } }[]) => {
        const last = logs.at(-1)
        if (last?.args.price != null) live.price = last.args.price
        try {
          await loadFrom(client)
        } catch (e) {
          live.error = errText(e)
          emitLive()
        }
      },
      onError: (e: Error) => {
        live.error = errText(e)
        emitLive()
      },
    }),
  )

  unwatch.push(
    client.watchContractEvent({
      address: liveAddr.fairLend,
      abi,
      eventName: 'Flagged',
      onLogs: (logs: readonly { args: { user?: `0x${string}`; startBlock?: bigint } }[]) => {
        for (const log of logs) {
          if (log.args.user?.toLowerCase() !== liveAddr.borrowerFair.toLowerCase()) continue
          if (log.args.startBlock != null) {
            live.fair.startBlock = log.args.startBlock
            live.flagFair = log.args.startBlock
          }
        }
        live.connection = 'live'
        live.error = undefined
        emitLive()
      },
    }),
  )

  unwatch.push(
    client.watchContractEvent({
      address: liveAddr.fairLend,
      abi,
      eventName: 'Liquidated',
      onLogs: async () => {
        try {
          await loadFrom(client)
        } catch (e) {
          live.error = errText(e)
          emitLive()
        }
      },
    }),
  )

  unwatch.push(
    client.watchBlockNumber({
      onBlockNumber: (n) => {
        live.blockNumber = n
        live.connection = 'live'
        emitLive()
      },
      onError: (e: Error) => {
        live.error = errText(e)
        emitLive()
      },
    }),
  )
}

async function startLive() {
  live.connection = 'connecting'
  emitLive()
  try {
    const httpClient = makeHttpClient()
    await loadFrom(httpClient)
    try {
      const wsClient = makePublicClient()
      await Promise.race([
        wsClient.getBlockNumber(),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('ws timeout')), 2500)
        }),
      ])
      attachWatches(wsClient)
    } catch {
      attachWatches(httpClient)
    }
  } catch (e) {
    live.connection = 'error'
    live.error = errText(e)
    emitLive()
  }
}

function ensureLive() {
  if (USE_MOCK || liveStarted || typeof window === 'undefined') return
  liveStarted = true
  void startLive()
}

export function useRun(): Run {
  return useSyncExternalStore(
    USE_MOCK ? subMock : subLive,
    () => (USE_MOCK ? mockRun : liveRun),
    () => mockRun,
  )
}
