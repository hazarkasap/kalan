import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { premiumStepPath } from '../components/premiumGeometry.ts'
import { txUrl } from '../chain.ts'
import { money, percent, storyData as d } from './storyData.ts'
import { scenes, type SceneId } from './scenes.ts'

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return reduced
}

export function AnimatedMoney({ value, reduced, initial = value }: { value: number; reduced: boolean; initial?: number }) {
  const element = useRef<HTMLSpanElement>(null)
  const current = useRef(initial)
  useLayoutEffect(() => {
    const start = performance.now()
    const from = current.current
    let frame = 0
    const tick = (now: number) => {
      const progress = reduced ? 1 : Math.min(1, (now - start) / 500)
      current.current = Math.round(from + (value - from) * (1 - (1 - progress) ** 3))
      // Whole dollars during the count, exact reconciled cents at the final frame.
      if (element.current) element.current.textContent = money(progress === 1 ? value : Math.round(current.current / 100) * 100)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, reduced])
  return <span ref={element}>{money(initial)}</span>
}

export function CollateralBar({ scene, reduced }: { scene: SceneId; reduced: boolean }) {
  const early = scene === 'hook' || scene === 'loan'
  const settled = ['result', 'monad', 'outro'].includes(scene)
  const fixed = scene === 'fixed' || scene === 'auction'
  const total = early ? d.initialTotal : d.total
  const bonus = settled ? d.fair.bonus : fixed ? d.fixed.bonus : 0
  const keep = total - d.debt - bonus
  const parts = [
    { id: 'debt', label: fixed || settled ? 'Debt repaid' : 'Debt owed', value: d.debt, start: 0 },
    { id: 'bonus', label: 'Liquidator bonus', value: bonus, start: d.debt },
    { id: 'keep', label: fixed || settled ? 'Alice keeps' : 'Remaining value', value: keep, start: d.debt + bonus },
  ]
  return <section className={`story-collateral ${scene === 'hook' ? 'not-yet' : ''} ${fixed ? 'fixed-split' : ''}`} aria-label={`Collateral allocation: ${parts.map(p => `${p.label} ${money(p.value)}`).join(', ')}`}>
    <div className="story-bar-heading"><span>Alice’s collateral</span><strong className="num"><AnimatedMoney value={total} reduced={reduced} /></strong></div>
    <div className={`story-bar ${scene === 'crash' ? 'story-shake' : ''}`}>
      {parts.map(p => <div key={p.id} className={`story-segment ${p.id}`} style={{ transform: `translateX(${p.start / d.initialTotal * 100}%) scaleX(${p.value / d.initialTotal})` }} />)}
    </div>
    <div className="story-bar-labels">{parts.map(p => <div className={p.id} key={p.id}>
      <span>{p.label}</span><strong className="num"><AnimatedMoney value={p.value} reduced={reduced} /></strong>
    </div>)}</div>
  </section>
}

export function HealthMeter({ unsafe }: { unsafe: boolean }) {
  return <div className={`story-health ${unsafe ? 'unsafe' : ''}`} role="img" aria-label={unsafe ? 'Loan unsafe' : 'Loan healthy'}>
    <div><i /><i /><i /><i /><i /></div><span>{unsafe ? 'UNSAFE' : 'HEALTHY'}</span>
  </div>
}

export function StoryPremiumChart({ local, reduced }: { local: number; reduced: boolean }) {
  const scene = scenes.find(s => s.id === 'auction')!
  const winAt = scene.cues[2].at
  const tailDuration = scene.duration - winAt - 1
  const current = reduced ? d.endBlock : local < winAt
    ? d.flagBlock + Math.min(d.blocks, Math.floor(local / (winAt / d.blocks)))
    : Math.min(d.endBlock, d.winBlock + Math.floor((local - winAt) / (tailDuration / (d.endBlock - d.winBlock))))
  const x = (block: number) => 90 + (block - d.flagBlock) / (d.endBlock - d.flagBlock) * 1200
  const maxPremium = (d.endBlock - d.flagBlock) * d.stepBps
  const y = (block: number) => 235 - (block - d.flagBlock) * d.stepBps / maxPremium * 180
  const end = Math.min(current, d.winBlock)
  const path = premiumStepPath(d.flagBlock, end, x, y)
  const future = premiumStepPath(d.winBlock, d.endBlock, x, y)
  return <div className="story-auction">
    <div className="story-chart-heading"><span>Bonus auction · +{percent(d.stepBps)} / block</span><strong className="num">Block {current}</strong></div>
    <svg viewBox="0 0 1400 310" role="img" aria-label={`Auction begins at block ${d.flagBlock}. Bot ${d.winner} wins at ${d.winBlock}. Later attempts revert.`}>
      <line x1="90" x2="1290" y1="235" y2="235" className="story-grid" />
      <text x="90" y="283">Flag · 0%</text>
      <path d={future} className="story-chart-future" />
      <path d={path} className="story-chart-line" />
      {d.attempts.filter(a => a.block <= current).map(a => <g key={a.hash} className="story-enter">
        <circle cx={x(a.block)} cy={y(a.block)} r="10" className={a.won ? 'story-win' : 'story-revert'} />
        <text x={x(a.block)} y={y(a.block) + (a.bot === 'B' ? 40 : -20)} textAnchor={a.bot === 'C' ? 'end' : 'middle'}>Bot {a.bot} · {a.won ? percent(d.fair.premiumBps) : 'reverted'}</text>
      </g>)}
      <text x="1290" y="283" textAnchor="end">{d.endBlock}</text>
    </svg>
    <ul className="story-attempt-list">{d.attempts.filter(a => a.block <= current).map(a => <li key={a.hash}>Bot {a.bot} · #{a.block} · {a.won ? `${percent(d.fair.premiumBps)} winner` : 'reverted'}</li>)}</ul>
    <p className="story-note">Solid: actual auction. Dashed: unused schedule after settlement.</p>
    <div className="story-receipts">{d.attempts.filter(a => a.block <= current).map(a => <a key={a.hash} href={txUrl(a.hash)} target="_blank" rel="noreferrer" aria-label={`Verify Bot ${a.bot} ${a.status} receipt`}>Bot {a.bot} · {a.hash.slice(0, 10)}… ↗</a>)}</div>
  </div>
}

const clock = (timestamp: number) => new Date(timestamp * 1000).toISOString().slice(11, 19)
export function ChainTimelines({ local, reduced }: { local: number; reduced: boolean }) {
  const max = d.blocks * d.ethereumStepSeconds
  // Playback is compressed, but both rails use the SAME 0–36 second time scale.
  const playbackDuration = scenes.find(s => s.id === 'monad')!.duration - 4
  const elapsed = reduced ? max : Math.min(max, Math.max(0, local - 1) / playbackDuration * max)
  const start = d.blockTimes[0].timestamp
  return <div className="story-timelines">
    {[false, true].map(ethereum => {
      const seconds = ethereum ? max : d.elapsedSeconds
      const ticks = d.blockTimes.slice(1).map((b, i) => ({ ...b, at: ethereum ? (i + 1) * d.ethereumStepSeconds : b.timestamp - start }))
      return <section key={String(ethereum)} className={ethereum ? 'ethereum' : 'monad'}>
        <div className="story-timeline-heading"><span>{ethereum ? 'Ethereum · model' : 'Monad · this run'}</span><strong className="num">{seconds} s</strong></div>
        <svg viewBox="0 0 650 100" role="img" aria-label={`${ethereum ? 'Ethereum model' : 'Monad observed'}: ${d.blocks} blocks in ${seconds} seconds`}>
          <line x1="15" x2="630" y1="45" y2="45" className="story-grid" />
          <line x1="15" x2={15 + Math.min(seconds, elapsed) / max * 615} y1="45" y2="45" className="story-timeline-line" />
          {ticks.map((t, i) => <line key={t.block} x1={15 + t.at / max * 615} x2={15 + t.at / max * 615} y1={25 - i * 5} y2={65 + i * 5} className="story-timeline-tick" opacity={elapsed >= t.at ? 1 : 0.15} />)}
          <text x="15" y="95">0 s</text><text x="630" y="95" textAnchor="end">{max} s</text>
        </svg>
        <ol>{ticks.map(t => <li key={t.block}><span className="num">{ethereum ? `Step ${t.block - d.flagBlock}` : `#${t.block}`}</span><span className="num">{ethereum ? `${t.at} s` : `${clock(t.timestamp)} UTC`}</span></li>)}</ol>
        <p className="story-note">{ethereum ? `${d.ethereumStepSeconds} s block time, constant. Assumes no missed slots.` : `Flag ${clock(start)} UTC. Timestamp precision: whole seconds.`}</p>
      </section>
    })}
    <div className="story-market-note"><svg viewBox="0 0 170 45" aria-hidden="true"><path d="M2 4L35 9L58 7L83 24L112 20L142 36L168 40" /></svg><span>Prices can keep falling · illustration, not measured price data</span></div>
  </div>
}
