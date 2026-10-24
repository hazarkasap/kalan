import { txUrl } from '../chain.ts'
import { pct } from '../format.ts'
import { BOT_NAMES, type AttemptView, type RunView } from '../run.ts'

function action(a: AttemptView) {
  const side = a.side === 'fixed' ? 'Fixed' : a.side === 'fair' ? 'Kalan' : ''
  return a.fn === 'flag' ? `${side} flag` : `${side} ${a.fn}`
}

type BotLogProps = { view?: RunView }

export function BotLog({ view }: BotLogProps) {
  const rows = view?.attempts ?? []
  const crash = view?.crashBlock ?? 0

  return (
    <section className="card log-card" aria-label="Bot race log">
      <div className="card-head">
        <h2>Bot race</h2>
        <span className="label">{rows.length} tx on-chain</span>
      </div>
      {rows.length === 0 ? (
        <p className="empty">
          {view?.phase === 'running' ? 'Waiting for the first bot transaction…' : 'No bot transactions in this run.'}
        </p>
      ) : (
        <ol className="log">
          {rows.map((a) => (
            <li key={a.hash} className={a.won ? 'won' : a.ok ? 'ok' : 'lost'}>
              <span className="mark" aria-label={a.ok ? 'succeeded' : 'reverted'}>
                {a.ok ? '✓' : '✗'}
              </span>
              <span className="who">Bot {BOT_NAMES[a.bot] ?? '?'}</span>
              <span className="what">
                {action(a)}
                <span className="why">{a.ok ? (a.won ? 'won' : '') : (a.reason ?? 'reverted')}</span>
              </span>
              <span className="prem num">{a.premiumBps != null ? pct(a.premiumBps) : '—'}</span>
              <span className="blk num">+{a.block - crash}</span>
              <a className="tx num" href={txUrl(a.hash)} target="_blank" rel="noreferrer">
                {a.hash.slice(0, 8)}↗
              </a>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
