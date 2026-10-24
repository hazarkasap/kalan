import { addressUrl, txUrl } from './chain.ts'
import { triggerMockCrash, useRun } from './data.ts'
import './App.css'

function usdKept(eth: number, price: number) {
  return (eth * price).toFixed(0)
}

function App() {
  const run = useRun()

  return (
    <main className="n0">
      <h1>Kalan</h1>
      <p className="sub">Liquidations that give back</p>
      <p className="price">
        ETH <span>{run.price.toLocaleString()}</span>
      </p>
      <button type="button" onClick={triggerMockCrash}>
        Market crash
      </button>
      <div className="row">
        <section>
          <h2>Fixed bonus (10%)</h2>
          <p>premium {run.fixed.premiumBps / 100}%</p>
          {run.fixed.liquidated ? (
            <p>
              Borrower keeps ${usdKept(run.fixed.liquidated.toBorrowerEth, run.price)}{' '}
              <a href={txUrl(run.fixed.liquidated.txHash)}>view tx</a>
            </p>
          ) : (
            <p>healthy</p>
          )}
        </section>
        <section>
          <h2>Kalan (fair auction)</h2>
          <p>premium {run.fair.premiumBps / 100}%</p>
          {run.fair.flaggedAtBlock != null && !run.fair.liquidated ? (
            <p>flagged @ {run.fair.flaggedAtBlock}</p>
          ) : null}
          {run.fair.liquidated ? (
            <p>
              Bot {run.fair.liquidated.botName} · Borrower keeps $
              {usdKept(run.fair.liquidated.toBorrowerEth, run.price)}{' '}
              <a href={addressUrl(run.fair.liquidated.liquidator)}>bot</a>{' '}
              <a href={txUrl(run.fair.liquidated.txHash)}>view tx</a>
            </p>
          ) : (
            <p>{run.price === 3000 ? 'healthy' : 'auction'}</p>
          )}
        </section>
      </div>
    </main>
  )
}

export default App
