import { useSyncExternalStore } from 'react'
import mockDeployments from './deployments.mock.json'

export const USE_MOCK = !import.meta.env.VITE_FAIRLEND

export type BotName = 'A' | 'B' | 'C'

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

const BOTS = mockDeployments.bots as [string, string, string]
const TX_FIXED =
  '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const TX_FAIR =
  '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

/** WETH to liquidator = min(collateral, debt * (1 + prem) / price); rest to borrower. */
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

function healthy(): Run {
  return {
    price: PRICE_START,
    fixed: side(FIXED_BPS),
    fair: side(0),
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
    liquidator: BOTS[botName === 'A' ? 0 : botName === 'B' ? 1 : 2],
    botName,
    premiumBps,
    toLiquidatorEth,
    toBorrowerEth,
    blockNumber,
    txHash,
  }
}

let run: Run = healthy()
const listeners = new Set<() => void>()
let tick: ReturnType<typeof setInterval> | null = null

function emit(next: Run) {
  run = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return run
}

export function useRun(): Run {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function triggerMockCrash(opts?: { immediate?: boolean }) {
  if (tick) {
    clearInterval(tick)
    tick = null
  }

  const crashedFixed = side(FIXED_BPS, {
    liquidated: settle(FIXED_BPS, 'A', FLAG_BLOCK, TX_FIXED),
  })

  if (opts?.immediate) {
    const blocks = FAIR_LIQ_BPS / STEP_BPS
    emit({
      price: PRICE_CRASH,
      fixed: crashedFixed,
      fair: side(FAIR_LIQ_BPS, {
        flaggedAtBlock: FLAG_BLOCK,
        liquidated: settle(FAIR_LIQ_BPS, 'A', FLAG_BLOCK + blocks, TX_FAIR),
      }),
    })
    return
  }

  emit({
    price: PRICE_CRASH,
    fixed: crashedFixed,
    fair: side(0, { flaggedAtBlock: FLAG_BLOCK }),
  })

  let blocksAfterFlag = 0
  tick = setInterval(() => {
    blocksAfterFlag += 1
    const premiumBps = Math.min(CAP_BPS, blocksAfterFlag * STEP_BPS)
    const blockNumber = FLAG_BLOCK + blocksAfterFlag

    if (premiumBps >= FAIR_LIQ_BPS) {
      emit({
        ...run,
        fair: side(FAIR_LIQ_BPS, {
          flaggedAtBlock: FLAG_BLOCK,
          liquidated: settle(FAIR_LIQ_BPS, 'A', blockNumber, TX_FAIR),
        }),
      })
      if (tick) clearInterval(tick)
      tick = null
      return
    }

    emit({
      ...run,
      fair: side(premiumBps, { flaggedAtBlock: FLAG_BLOCK }),
    })
  }, BLOCK_MS)
}
