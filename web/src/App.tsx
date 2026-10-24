import { useEffect } from 'react'
import { AdminBar } from './components/AdminBar.tsx'
import { Header } from './components/Header.tsx'
import { Panel, type Status } from './components/Panel.tsx'
import {
  BLOCK_MS,
  FAIR_LIQ_BPS,
  STEP_BPS,
  triggerMockCrash,
  USE_MOCK,
  useRun,
  type Side,
} from './data.ts'
import './App.css'

function sideStatus(side: Side, price: number, connecting: boolean): Status {
  if (connecting) return 'Healthy'
  if (side.liquidated) return 'Liquidated'
  if (price > 0 && price < 3000) return 'Liquidatable'
  return 'Healthy'
}

function settleCopy(fair: Side, connection: ReturnType<typeof useRun>['connection']) {
  if (connection === 'connecting') return 'Connecting…'
  if (fair.liquidated && fair.flaggedAtBlock != null) {
    const blocks = Math.max(0, fair.liquidated.blockNumber - fair.flaggedAtBlock)
    const seconds = (blocks * BLOCK_MS) / 1000
    return `Settled in ${blocks} blocks ≈ ${seconds.toFixed(1)} s`
  }
  if (fair.liquidated) {
    return `Settled in block ${fair.liquidated.blockNumber}`
  }
  if (fair.flaggedAtBlock != null) {
    const remaining = Math.max(0, Math.ceil((FAIR_LIQ_BPS - fair.premiumBps) / STEP_BPS))
    const seconds = (remaining * BLOCK_MS) / 1000
    return `Waiting for block… ${remaining} left · ~${seconds.toFixed(1)} s`
  }
  return 'Last run · waiting for crash'
}

function App() {
  const run = useRun()
  const connecting = run.connection === 'connecting'

  useEffect(() => {
    if (!import.meta.env.DEV || !USE_MOCK) return
    const params = new URLSearchParams(window.location.search)
    if (params.has('settled')) triggerMockCrash({ immediate: true })
    else if (params.has('crash')) triggerMockCrash()
  }, [])

  return (
    <div className="app">
      {run.connection === 'error' && run.error ? (
        <div className="banner error" role="alert">
          RPC failed: {run.error}
        </div>
      ) : null}
      {connecting ? <div className="banner">Connecting…</div> : null}
      <Header price={run.price} connecting={connecting} />
      <AdminBar />
      <div className="panels">
        <Panel
          title="Fixed bonus (10%)"
          side={run.fixed}
          price={run.price}
          status={sideStatus(run.fixed, run.price, connecting)}
          connecting={connecting}
          blockNumber={run.blockNumber}
        />
        <Panel
          title="Kalan (fair auction)"
          side={run.fair}
          price={run.price}
          status={sideStatus(run.fair, run.price, connecting)}
          accent
          waiting={!connecting && run.fair.flaggedAtBlock != null && !run.fair.liquidated}
          connecting={connecting}
          blockNumber={run.blockNumber}
          showRace
        />
      </div>
      <footer className="settle">{settleCopy(run.fair, run.connection)}</footer>
    </div>
  )
}

export default App
