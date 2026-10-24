import { useLayoutEffect, useRef, useState } from 'react'
import { pct } from '../format.ts'
import { BOT_NAMES, FIXED_BPS, premiumAt, type RunView } from '../run.ts'

const MIN_BLOCKS = 12
const Y_MAX_BPS = 1100
const PAD = { top: 28, right: 112, bottom: 48, left: 64 }

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ w: Math.round(width), h: Math.round(height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size] as const
}

type PremiumChartProps = { view?: RunView; head?: number }

export function PremiumChart({ view, head }: PremiumChartProps) {
  const [ref, { w, h }] = useSize<HTMLDivElement>()
  const narrow = w < 520
  const pad = narrow ? { ...PAD, right: 64, left: 48 } : PAD

  const crash = view?.crashBlock ?? 0
  const end = view ? (view.phase === 'running' ? (head ?? view.endBlock) : view.endBlock) : 0
  const span = Math.max(MIN_BLOCKS, end - crash + 1)
  const iw = Math.max(0, w - pad.left - pad.right)
  const ih = Math.max(0, h - pad.top - pad.bottom)
  const x = (blocks: number) => pad.left + (blocks / span) * iw
  const y = (bps: number) => pad.top + ih - (bps / Y_MAX_BPS) * ih

  // Kalan: 0 until the flag, then +50 bps per block (steps), drawn up to the last known block.
  let kalan = ''
  if (view) {
    for (let b = crash; b <= end; b++) {
      const px = x(b - crash)
      const py = y(premiumAt(view.flagBlock, b))
      kalan += b === crash ? `M${px},${py}` : `H${px}V${py}`
    }
    kalan += `H${x(end - crash + 1)}`
  }

  const liquidations = view?.attempts.filter((a) => a.fn === 'liquidate' && a.premiumBps != null) ?? []
  const yTicks = [0, 250, 500, 750, 1000]
  const xStep = span > 30 ? 10 : span > 16 ? 4 : 2
  const xTicks = Array.from({ length: Math.floor(span / xStep) + 1 }, (_, i) => i * xStep)

  return (
    <section className="card chart-card" aria-label="Liquidation premium per block">
      <div className="card-head">
        <h2>Premium per block</h2>
        <span className="label num">
          {view?.phase === 'running' && head != null ? `live · block +${head - crash}` : `${end - crash} blocks`}
        </span>
      </div>
      <div className="chart" ref={ref}>
        {w > 0 && h > 0 ? (
          <svg width={w} height={h} role="img" aria-label="Fixed bonus stays at 10%; Kalan premium rises 0.5% per block">
            {yTicks.map((t) => (
              <g key={t}>
                <line className="grid" x1={pad.left} x2={w - pad.right} y1={y(t)} y2={y(t)} />
                <text className="tick" x={pad.left - 10} y={y(t)} textAnchor="end" dominantBaseline="middle">
                  {t / 100}%
                </text>
              </g>
            ))}
            {xTicks.map((t) => (
              <text key={t} className="tick" x={x(t)} y={h - pad.bottom + 22} textAnchor="middle">
                {t}
              </text>
            ))}
            <text className="axis" x={pad.left + iw / 2} y={h - 6} textAnchor="middle">
              blocks since price drop
            </text>

            {view ? (
              <>
                {view.flagBlock != null ? (
                  <g>
                    <line className="flag" x1={x(view.flagBlock - crash)} x2={x(view.flagBlock - crash)} y1={pad.top} y2={pad.top + ih} />
                    <text className="tick" x={x(view.flagBlock - crash) + 6} y={pad.top + 14}>
                      flag
                    </text>
                  </g>
                ) : null}

                <line className="fixed-line" x1={x(0)} x2={x(span)} y1={y(FIXED_BPS)} y2={y(FIXED_BPS)} />
                <text className="series fixed-label" x={x(span) + 8} y={y(FIXED_BPS)} dominantBaseline="middle">
                  {narrow ? 'Fixed' : 'Fixed 10%'}
                </text>

                <path key={view.crashBlock} className={`kalan-line${view.phase === 'running' ? '' : ' draw'}`} d={kalan} />
                <text
                  className="series kalan-label"
                  x={x(end - crash + 1) + 8}
                  y={y(premiumAt(view.flagBlock, end))}
                  dominantBaseline="middle"
                >
                  Kalan
                </text>

                {liquidations.map((a) => {
                  const cx = x(a.block - crash)
                  const cy = y(a.premiumBps!)
                  const name = `Bot ${BOT_NAMES[a.bot] ?? '?'}`
                  return (
                    <g key={a.hash} className={`dot ${a.side}${a.won ? ' won' : ''}`}>
                      <circle cx={cx} cy={cy} r={a.won ? 9 : 7} />
                      {a.won ? (
                        <text className="dot-label" x={cx} y={cy - 18} textAnchor="middle">
                          {name} · {pct(a.premiumBps)}
                        </text>
                      ) : null}
                    </g>
                  )
                })}
              </>
            ) : null}
          </svg>
        ) : null}
      </div>
      <p className="legend">
        <span className="key won" /> winning liquidation <span className="key lost" /> reverted attempt
      </p>
    </section>
  )
}
