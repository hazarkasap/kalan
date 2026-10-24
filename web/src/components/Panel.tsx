import { txUrl } from '../chain.ts'
import type { Side } from '../data.ts'
import { BigNumber } from './BigNumber.tsx'

export type Status = 'Healthy' | 'Liquidatable' | 'Liquidated'

type PanelProps = {
  title: string
  side: Side
  price: number
  accent?: boolean
  status: Status
}

function formatUsd(value: number) {
  return Math.round(value).toLocaleString('en-US')
}

function premiumPct(bps: number) {
  return `${(bps / 100).toFixed(1)}%`
}

export function Panel({ title, side, price, accent = false, status }: PanelProps) {
  const kept = side.liquidated
    ? side.liquidated.toBorrowerEth * price
    : null

  return (
    <section className={accent ? 'panel accent-panel' : 'panel'}>
      <h2>{title}</h2>
      <dl className="stats">
        <div>
          <dt>Collateral</dt>
          <dd>{side.collateralEth} WETH</dd>
        </div>
        <div>
          <dt>Debt</dt>
          <dd>${formatUsd(side.debtUsd)}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd className={`status status-${status.toLowerCase()}`}>{status}</dd>
        </div>
        <div>
          <dt>Premium</dt>
          <dd className="num">{premiumPct(side.premiumBps)}</dd>
        </div>
      </dl>

      {side.liquidated && kept != null ? (
        <div className="outcome">
          <p className="winner">
            Bot {side.liquidated.botName} won at {premiumPct(side.liquidated.premiumBps)}
          </p>
          <BigNumber accent={accent}>{`Borrower keeps $${formatUsd(kept)}`}</BigNumber>
          <a className="tx" href={txUrl(side.liquidated.txHash)} target="_blank" rel="noreferrer">
            view tx
          </a>
        </div>
      ) : (
        <div className="outcome pending">
          <BigNumber>{status === 'Healthy' ? 'Position healthy' : 'Auction running'}</BigNumber>
        </div>
      )}
    </section>
  )
}
