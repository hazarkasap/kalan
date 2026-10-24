import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
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
  // idle: resetDemo() came after this run, so positions are reopened and waiting for a crash
  return `Reset done · ready — press Crash price · showing last run (${range})`
}

function Dashboard() {
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

const Story = lazy(() => import('./story/Story.tsx'))

function App() {
  const [story, setStory] = useState(() => location.pathname.replace(/\/$/, '') === '/story')
  const [leaving, setLeaving] = useState(false)
  const recording = new URLSearchParams(location.search).get('record') === '1'
  const exit = useCallback(() => setLeaving(true), [])
  useEffect(() => {
    const pop = () => { setLeaving(false); setStory(location.pathname.replace(/\/$/, '') === '/story') }
    window.addEventListener('popstate', pop)
    return () => window.removeEventListener('popstate', pop)
  }, [])
  useEffect(() => {
    if (!leaving) return
    history.pushState({}, '', recording ? '/?record=1' : '/')
    const timer = setTimeout(() => { setStory(false); setLeaving(false) }, 500)
    return () => clearTimeout(timer)
  }, [leaving, recording])
  return <>
    {(!story || leaving) && <div className={`route-stage ${recording ? 'recording-dashboard' : ''}`}><Dashboard /></div>}
    {story && <div className={leaving ? 'story-exit-overlay' : ''}><Suspense fallback={<p className="app">Loading story…</p>}><Story onExit={exit} /></Suspense></div>}
  </>
}

export default App
