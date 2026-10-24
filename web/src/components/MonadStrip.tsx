import { seconds } from '../format.ts'
import { ETH_BLOCK_S, type RunView } from '../run.ts'

type MonadStripProps = { view?: RunView }

export function MonadStrip({ view }: MonadStripProps) {
  const auction = view?.auction
  return (
    <footer className="strip" aria-label="Auction length on Monad vs Ethereum">
      <div className="strip-cell">
        <span className="label">Monad · this run</span>
        <span className="strip-value num">
          {auction ? `${auction.blocks} blocks · ${auction.seconds != null ? seconds(auction.seconds) : '…'}` : '—'}
        </span>
        <span className="label">
          {view?.blockTimeS != null ? `${view.blockTimeS.toFixed(2)} s/block from block timestamps` : 'flag → winning liquidation'}
        </span>
      </div>
      <div className="strip-cell">
        <span className="label">Same auction on Ethereum</span>
        <span className="strip-value muted num">
          {auction ? `${auction.blocks} blocks · ${seconds(auction.blocks * ETH_BLOCK_S)}` : '—'}
        </span>
        <span className="label">{ETH_BLOCK_S} s block time (constant)</span>
      </div>
    </footer>
  )
}
