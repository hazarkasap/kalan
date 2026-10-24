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
import { CRASH_PRICE, USE_MOCK, triggerMockCrash } from '../data.ts'
import deployments from '../deployments.json'

const fairLend = deployments.fairLend as `0x${string}`
const oracle = deployments.oracle as `0x${string}`

export function AdminBar() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending: connecting } = useConnect()
  const { disconnect } = useDisconnect()
  const chainId = useChainId()
  const { switchChainAsync } = useSwitchChain()
  const { data: admin } = useReadContract({
    address: fairLend,
    abi,
    functionName: 'admin',
    query: { enabled: !USE_MOCK },
  })

  const { writeContract, data: hash, isPending, error, reset } = useWriteContract()
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash })
  const [action, setAction] = useState<'crash' | 'reset' | null>(null)

  const isAdmin =
    !!address && !!admin && address.toLowerCase() === admin.toLowerCase()
  const busy = isPending || confirming

  async function ensureChain() {
    if (chainId !== monadTestnet.id) {
      await switchChainAsync({ chainId: monadTestnet.id })
    }
  }

  async function crash() {
    if (USE_MOCK) {
      triggerMockCrash()
      return
    }
    setAction('crash')
    reset()
    await ensureChain()
    writeContract({
      address: oracle,
      abi,
      functionName: 'setPrice',
      args: [CRASH_PRICE],
    })
  }

  async function resetDemo() {
    setAction('reset')
    reset()
    await ensureChain()
    writeContract({
      address: fairLend,
      abi,
      functionName: 'resetDemo',
    })
  }

  const injected = connectors[0]

  return (
    <div className="admin">
      <div className="admin-row">
        {USE_MOCK ? (
          <button type="button" className="crash" onClick={crash}>
            Market crash
          </button>
        ) : isAdmin ? (
          <>
            <button type="button" className="crash" onClick={() => void crash()} disabled={busy}>
              {action === 'crash' && busy ? 'Crashing…' : 'Market crash'}
            </button>
            <button type="button" className="reset" onClick={() => void resetDemo()} disabled={busy}>
              {action === 'reset' && busy ? 'Resetting…' : 'Reset demo'}
            </button>
          </>
        ) : (
          <p className="readonly">Last run · read-only</p>
        )}

        {!USE_MOCK ? (
          isConnected ? (
            <button type="button" className="wallet" onClick={() => disconnect()}>
              {address?.slice(0, 6)}…{address?.slice(-4)}
            </button>
          ) : (
            <button
              type="button"
              className="wallet"
              disabled={!injected || connecting}
              onClick={() => injected && connect({ connector: injected })}
            >
              Connect wallet
            </button>
          )
        ) : null}
      </div>

      {hash ? (
        <p className="admin-tx">
          {confirming ? 'Waiting for receipt… ' : isSuccess ? 'Confirmed · ' : ''}
          <a href={txUrl(hash)} target="_blank" rel="noreferrer">
            view tx
          </a>
        </p>
      ) : null}
      {error ? <p className="admin-err">{error.message}</p> : null}
    </div>
  )
}
