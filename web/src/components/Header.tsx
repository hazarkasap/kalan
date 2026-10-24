import type { RunView } from '../run.ts'
import { usd } from '../format.ts'
import { Controls } from './Controls.tsx'

type HeaderProps = {
  view?: RunView
  oraclePrice?: number
}

export function Header({ view, oraclePrice }: HeaderProps) {
  const drop = view ? ((view.priceAfter - view.priceBefore) / view.priceBefore) * 100 : null
  // After resetDemo() the oracle is back up while the screen still shows the last run's drop.
  const showNow = oraclePrice != null && view != null && oraclePrice !== view.priceAfter

  return (
    <header className="header">
      <div className="brand">
        <h1>Kalan</h1>
        <p className="subtitle">Liquidations that give back</p>
        <a className="story-dashboard-link" href="/story">Play the 90-second story →</a>
      </div>
      <div className="header-right">
        <div className="eth">
          <span className="label">ETH / USD · oracle</span>
          {view && drop != null ? (
            <p className="eth-move num">
              {usd(view.priceBefore)} → <strong>{usd(view.priceAfter)}</strong>{' '}
              <span className="eth-drop">▼ {drop.toFixed(1)}%</span>
            </p>
          ) : (
            <p className="eth-move num">{usd(oraclePrice)}</p>
          )}
          {showNow ? <span className="label">now {usd(oraclePrice)}</span> : null}
        </div>
        <Controls running={view?.phase === 'running'} />
      </div>
    </header>
  )
}
