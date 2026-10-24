import { useEffect } from 'react'
import { CrashButton } from './components/CrashButton.tsx'
import { Header } from './components/Header.tsx'
import { Panel, type Status } from './components/Panel.tsx'
import {
  BLOCK_MS,
  FAIR_LIQ_BPS,
  STEP_BPS,
  triggerMockCrash,
  useRun,
  type Side,
} from './data.ts'
import './App.css'

function sideStatus(side: Side, price: number): Status {
  if (side.liquidated) return 'Liquidated'
  if (price < 3000) return 'Liquidatable'
  return 'Healthy'
}

function settleCopy(fair: Side) {
  if (fair.liquidated && fair.flaggedAtBlock != null) {
    const blocks = fair.liquidated.blockNumber - fair.flaggedAtBlock
    const seconds = (blocks * BLOCK_MS) / 1000
    return `Blocks to settle: ${blocks} · ~${seconds.toFixed(1)} s`
  }
  if (fair.flaggedAtBlock != null) {
    const remaining = Math.max(0, Math.ceil((FAIR_LIQ_BPS - fair.premiumBps) / STEP_BPS))
    const seconds = (remaining * BLOCK_MS) / 1000
    return `Blocks to settle: ${remaining} · ~${seconds.toFixed(1)} s`
  }
  return 'Blocks to settle: — · waiting for crash'
}

function App() {
  const run = useRun()

  useEffect(() => {
    if (!import.meta.env.DEV) return
    const params = new URLSearchParams(window.location.search)
    if (params.has('settled')) triggerMockCrash({ immediate: true })
    else if (params.has('crash')) triggerMockCrash()
  }, [])

  return (
    <div className="app">
      <Header price={run.price} />
      <CrashButton onCrash={triggerMockCrash} />
      <div className="panels">
        <Panel
          title="Fixed bonus (10%)"
          side={run.fixed}
          price={run.price}
          status={sideStatus(run.fixed, run.price)}
        />
        <Panel
          title="Kalan (fair auction)"
          side={run.fair}
          price={run.price}
          status={sideStatus(run.fair, run.price)}
          accent
        />
      </div>
      <footer className="settle">{settleCopy(run.fair)}</footer>
    </div>
  )
}

export default App
