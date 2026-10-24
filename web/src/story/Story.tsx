import { useCallback, useEffect, useRef, useState } from 'react'
import { duration, initialTime, sceneAt, scenes, starts } from './scenes.ts'
import { money, percent, ratio, storyData as d } from './storyData.ts'
import { AnimatedMoney, ChainTimelines, CollateralBar, HealthMeter, StoryPremiumChart, useReducedMotion } from './visuals.tsx'
import './story.css'

function CaptionLayer({ text, identity, delay }: { text: string; identity: string; delay: boolean }) {
  return <div className="story-caption-layer" aria-live="polite" aria-atomic="true">
    <h1 key={identity} className={`story-caption story-enter ${delay ? 'story-caption-delayed' : ''}`}>{text}</h1>
  </div>
}

function PlaybackControls({ time, playing, index, jump, toggle, narration, toggleNarration, speechAvailable }: {
  time: number; playing: boolean; index: number; jump: (index: number) => void; toggle: () => void
  narration: boolean; toggleNarration: () => void; speechAvailable: boolean
}) {
  return <nav className="story-controls" aria-label="Story playback">
    <div className="story-control-row">
      <button onClick={() => jump(index - 1)} disabled={index === 0} aria-label="Previous scene">←</button>
      <button onClick={toggle} aria-label={playing ? 'Pause story' : 'Play story'}>{playing ? 'Pause' : 'Play'} <kbd>Space</kbd></button>
      <button onClick={() => jump(index + 1)} disabled={index === scenes.length - 1} aria-label="Next scene">→</button>
      <button onClick={() => jump(0)}>Restart <kbd>R</kbd></button>
      {speechAvailable && <button onClick={toggleNarration} aria-pressed={narration}>Voice {narration ? 'on' : 'off'} <kbd>N</kbd></button>}
      <span className="num">{Math.floor(time)} / {duration} s</span>
      <a href="/story-voiceover.txt" download>Voiceover script ↓</a>
    </div>
    <div className="story-progress" aria-label="Scene navigation">
      <div className="story-progress-fill" style={{ transform: `scaleX(${time / duration})` }} />
      {scenes.map((s, i) => <button key={s.id} style={{ left: `${starts[i] / duration * 100}%` }} aria-label={`Scene ${i + 1}: ${s.title}`} aria-current={i === index ? 'step' : undefined} onClick={() => jump(i)}><span>{i + 1}</span></button>)}
    </div>
  </nav>
}

export default function Story({ onExit }: { onExit: () => void }) {
  const [time, setTime] = useState(() => initialTime(location.search))
  const timeRef = useRef(time)
  const [playing, setPlaying] = useState(true)
  const [narration, setNarration] = useState(false)
  const [seek, setSeek] = useState(0)
  const [voiceError, setVoiceError] = useState('')
  const record = new URLSearchParams(location.search).get('record') === '1'
  const reduced = useReducedMotion()
  const { scene, index, local, cue, cueIndex } = sceneAt(time)
  const speechAvailable = 'speechSynthesis' in window
  const jump = useCallback((index: number) => {
    const next = starts[Math.min(scenes.length - 1, Math.max(0, index))]
    timeRef.current = next
    setTime(next)
    setSeek(n => n + 1)
  }, [])
  const toggle = useCallback(() => setPlaying(p => !p), [])
  const toggleNarration = useCallback(() => setNarration(n => !n), [])

  useEffect(() => {
    if (!playing) return
    let last = performance.now()
    let renderAt = last
    let frame = 0
    const tick = (now: number) => {
      // Background tabs must not silently skip the presentation.
      if (!document.hidden) timeRef.current = Math.min(duration, timeRef.current + (now - last) / 1000)
      last = now
      if (now - renderAt >= 32 || timeRef.current >= duration) {
        setTime(timeRef.current)
        renderAt = now
      }
      if (timeRef.current < duration) frame = requestAnimationFrame(tick)
    }
    const visible = () => { last = performance.now() }
    document.addEventListener('visibilitychange', visible)
    frame = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', visible) }
  }, [playing, seek])

  useEffect(() => {
    if (time >= duration) onExit()
  }, [time, onExit])

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (event.altKey || event.ctrlKey || event.metaKey || target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (event.repeat) return
      const key = event.key.toLowerCase()
      if (key === ' ' && ['BUTTON', 'A'].includes(target.tagName)) return
      if (![' ', 'arrowleft', 'arrowright', 'r', 'n'].includes(key)) return
      event.preventDefault()
      if (key === ' ') toggle()
      if (key === 'arrowleft') jump(index - 1)
      if (key === 'arrowright') jump(index + 1)
      if (key === 'r') jump(0)
      if (key === 'n' && speechAvailable) toggleNarration()
    }
    window.addEventListener('keydown', keyboard)
    return () => window.removeEventListener('keydown', keyboard)
  }, [index, jump, toggle, toggleNarration, speechAvailable])

  useEffect(() => {
    if (!speechAvailable) return
    speechSynthesis.cancel()
    if (narration) {
      speechSynthesis.resume()
      const utterance = new SpeechSynthesisUtterance(cue.voiceover)
      utterance.lang = 'en-US'
      utterance.rate = 1
      utterance.onerror = event => {
        if (!['interrupted', 'canceled'].includes(event.error)) setVoiceError('Browser voice unavailable. Use the downloadable voiceover script.')
      }
      speechSynthesis.speak(utterance)
      if (!playing) speechSynthesis.pause()
    }
    return () => speechSynthesis.cancel()
    // Playback is controlled separately so pause/resume does not repeat the cue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cue, narration, seek, speechAvailable])

  useEffect(() => {
    if (!speechAvailable || !narration) return
    if (playing) speechSynthesis.resume()
    else speechSynthesis.pause()
  }, [playing, narration, speechAvailable])

  return <main className={`story ${record ? 'story-record' : ''} ${!playing ? 'story-paused' : ''}`} data-scene={scene.id} aria-label="Kalan story mode">
    <header className="story-masthead"><a href="/" aria-label="Return to dashboard">Kalan<span> / STORY</span></a><span>MONAD TESTNET · VERIFIED RUN</span></header>
    <CaptionLayer text={cue.caption} identity={`${scene.id}-${cueIndex}`} delay={scene.id === 'hook'} />
    <div className={`story-visual story-visual-${scene.id}`} key={scene.id}>
      {scene.id === 'hook' && <div className="story-brand story-enter">Kalan<span>Liquidations that give back</span></div>}
      {(scene.id === 'loan' || scene.id === 'crash') && <div className="story-price story-enter">
        <div><span className="story-eyebrow">ETH / USD</span><strong className="story-hero num"><AnimatedMoney value={scene.id === 'loan' ? d.priceBefore : d.priceAfter} initial={d.priceBefore} reduced={reduced} /></strong></div>
        <HealthMeter unsafe={scene.id === 'crash'} />
      </div>}
      {scene.id === 'fixed' && <div className="story-result story-enter"><span className="story-eyebrow">THE FIXED CUT</span><strong className="story-hero num story-red">{percent(d.fixed.premiumBps)}</strong><p>Alice keeps <strong className="num">{money(d.fixed.keep)}</strong></p></div>}
      {scene.id === 'auction' && <StoryPremiumChart local={local} reduced={reduced} />}
      {scene.id === 'result' && <div className="story-result story-enter"><span className="story-eyebrow">MORE LEFT FOR ALICE</span><strong className="story-hero num story-orange">{ratio}×</strong><p>The liquidator still earns <strong className="num">{money(d.fair.bonus)}</strong>.</p></div>}
      {scene.id === 'monad' && <ChainTimelines local={local} reduced={reduced} />}
      {scene.id === 'outro' && <div className="story-outro story-enter"><div className="story-brand">Kalan</div><button className="story-live" onClick={onExit}>Watch it live →</button></div>}
    </div>
    <CollateralBar scene={scene.id} reduced={reduced} />
    <footer className="story-source">One completed run · # {d.flagBlock} → {d.winBlock} · USD rounded to cents · Alice is a demo persona; collateral is WETH</footer>
    {!record && <><PlaybackControls time={time} playing={playing} index={index} jump={jump} toggle={toggle} narration={narration} toggleNarration={toggleNarration} speechAvailable={speechAvailable} />{voiceError && <p className="story-voice-error" role="status">{voiceError}</p>}</>}
  </main>
}
