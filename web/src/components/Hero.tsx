import { useEffect, useRef, useState } from 'react'
import { pct, usd } from '../format.ts'
import type { RunView } from '../run.ts'

/** Counts up to `target` whenever `key` changes (e.g. a run settles); instant with reduced motion. */
function useCountUp(target: number | null, key: string, ms = 900): number | null {
  const [anim, setAnim] = useState<{ key: string; value: number } | null>(null)
  const prevKey = useRef(key)

  useEffect(() => {
    if (prevKey.current === key) return
    prevKey.current = key
    const to = target
    if (to == null || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const t0 = performance.now()
    let raf = requestAnimationFrame(function step(t) {
      const k = Math.min(1, (t - t0) / ms)
      setAnim(k < 1 ? { key, value: to * (1 - (1 - k) ** 3) } : null)
      if (k < 1) raf = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(raf)
  }, [key, target, ms])

  return anim && anim.key === key ? anim.value : target
}

type HeroProps = { view?: RunView }

export function Hero({ view }: HeroProps) {
  const settledKey = view ? `${view.crashBlock}:${view.phase}` : 'none'
  const fixedKeep = useCountUp(view?.fixed.keepUsd ?? null, settledKey)
  const fairKeep = useCountUp(view?.fair.keepUsd ?? null, settledKey)

  const live = view?.phase === 'running'
  const f = view?.fixed.keepUsd
  const k = view?.fair.keepUsd
  const ratio = f != null && k != null && f > 0 ? k / f : null
  const delta = f != null && k != null ? k - f : null

  return (
    <section className={`hero${live ? ' live' : ''}`} aria-label="What the borrower keeps">
      <p className="hero-title">Borrower keeps</p>
      <div className="hero-row">
        <div className="hero-side">
          <span className="label">Fixed {pct(view?.fixed.premiumBps ?? null, 0)} bonus</span>
          <span className="hero-value muted num">{usd(fixedKeep)}</span>
          <span className="loss num">
            {view?.fixed.bonusUsd != null ? `−${usd(view.fixed.bonusUsd)} to liquidator bonus` : ' '}
          </span>
        </div>
        <span className="hero-sep" aria-hidden="true">
          ·
        </span>
        <div className="hero-side">
          <span className="label">
            Kalan {pct(view?.fair.premiumBps ?? null)}
            {live ? ' · if taken now' : ''}
          </span>
          <span className="hero-value num">{usd(fairKeep)}</span>
          <span className="loss num">
            {view?.fair.bonusUsd != null ? `−${usd(view.fair.bonusUsd)} to liquidator bonus` : ' '}
          </span>
        </div>
        <div className="hero-mult">
          <span className="hero-mult-value num">
            {ratio != null ? `${ratio.toFixed(1)}×` : delta != null ? `+${usd(delta)}` : '—'}
          </span>
          <span className="label">
            {ratio != null ? `more · +${usd(delta)}` : 'more to the borrower'}
            {live ? ' · live' : ''}
          </span>
        </div>
      </div>
    </section>
  )
}
