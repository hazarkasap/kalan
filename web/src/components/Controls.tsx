import { useState } from 'react'
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { abi } from '../abi.ts'
import { monadTestnet, txUrl } from '../chain.ts'
import deployments from '../deployments.json'
import { short } from '../format.ts'
import { CRASH_PRICE } from '../run.ts'

const fairLend = deployments.fairLend as `0x${string}`
const oracle = deployments.oracle as `0x${string}`

type ControlsProps = {
  /** A run is in progress: crashing again would make no sense. */
  running: boolean
}

/** Primary "Crash price (live)" button plus small wallet / reset controls (admin wallet only). */
export function Controls({ running }: ControlsProps) {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending: connecting } = useConnect()
  const { disconnect } = useDisconnect()
  const chainId = useChainId()
  const { switchChainAsync } = useSwitchChain()
  const { data: admin } = useReadContract({ address: fairLend, abi, functionName: 'admin' })

  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const { isLoading: confirming } = useWaitForTransactionReceipt({ hash })
  const [action, setAction] = useState<'crash' | 'reset' | null>(null)

  const isAdmin = !!address && !!admin && address.toLowerCase() === admin.toLowerCase()
  const busy = isPending || confirming
  const injected = connectors[0]

  async function send(kind: 'crash' | 'reset') {
    setAction(kind)
    reset()
    if (chainId !== monadTestnet.id) await switchChainAsync({ chainId: monadTestnet.id })
    if (kind === 'crash') {
      writeContract({ address: oracle, abi, functionName: 'setPrice', args: [CRASH_PRICE] })
    } else {
      writeContract({ address: fairLend, abi, functionName: 'resetDemo' })
    }
  }

  function onCrash() {
    if (!isConnected) {
      if (injected) connect({ connector: injected })
      return
    }
    void send('crash')
  }

  const crashLabel =
    action === 'crash' && busy ? 'Crashing…' : running ? 'Auction running…' : 'Crash price (live)'

  return (
    <div className="controls">
      <button
        type="button"
        className="crash"
        onClick={onCrash}
        disabled={running || busy || connecting || (isConnected && !isAdmin)}
        title={isConnected && !isAdmin ? 'Only the admin wallet can move the oracle' : undefined}
      >
        {crashLabel}
      </button>
      <div className="controls-small">
        {isConnected ? (
          <>
            {isAdmin ? (
              <button type="button" className="ghost" onClick={() => void send('reset')} disabled={busy}>
                {action === 'reset' && busy ? 'Resetting…' : 'Reset demo'}
              </button>
            ) : (
              <span className="hint">not admin</span>
            )}
            <button type="button" className="ghost" onClick={() => disconnect()}>
              {address ? short(address) : 'wallet'}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="ghost"
            disabled={!injected || connecting}
            onClick={() => injected && connect({ connector: injected })}
          >
            {connecting ? 'Connecting…' : 'Admin wallet'}
          </button>
        )}
        {hash ? (
          <a className="hint" href={txUrl(hash)} target="_blank" rel="noreferrer">
            {confirming ? 'pending tx' : 'tx'} ↗
          </a>
        ) : null}
      </div>
      {error ? <p className="controls-err">{error.message.split('\n')[0]}</p> : null}
    </div>
  )
}
