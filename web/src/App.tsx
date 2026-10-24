import { BotLog } from './components/BotLog.tsx'
import { Header } from './components/Header.tsx'
import { Hero } from './components/Hero.tsx'
import { MonadStrip } from './components/MonadStrip.tsx'
import { PremiumChart } from './components/PremiumChart.tsx'
import { useRun, type Snapshot } from './data.ts'
import './App.css'

function runLabel({ view, head, connection }: Snapshot): string {
  if (!view) return connection === 'connecting' ? 'Loading last run…' : 'No run found yet — press Crash price'
  const range = `blocks ${view.crashBlock}–${view.endBlock}`
  if (view.phase === 'running') return `Live run · block ${head ?? view.endBlock}`
  if (view.phase === 'settled') return `Settled · ${range}`
  return `Last run · ${range}`
}

function App() {
  const run = useRun()
  const { view } = run

  return (
    <div className={`app phase-${view?.phase ?? 'empty'}`}>
      {run.connection === 'error' ? (
        <div className="banner" role="alert">
          {view ? 'Live run failed — showing last run' : 'RPC unreachable — retrying'}
          {run.error ? <span className="banner-detail"> · {run.error}</span> : null}
        </div>
      ) : null}
      <Header view={view} oraclePrice={run.oraclePrice} />
      <p className="run-label num">
        <span className={`dot-state ${view?.phase ?? 'empty'}`} aria-hidden="true" />
        {runLabel(run)}
      </p>
      <Hero view={view} />
      <div className="middle">
        <PremiumChart view={view} head={run.head} />
        <BotLog view={view} />
      </div>
      <MonadStrip view={view} />
    </div>
  )
}

export default App
