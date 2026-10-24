import { defineChain } from 'viem'

const EXPLORER = 'https://testnet.monadvision.com'
const http = import.meta.env.VITE_RPC_URL || 'https://rpc-testnet.monadinfra.com'
const ws = import.meta.env.VITE_WS_URL as string | undefined

export const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: {
      http: [http],
      ...(ws ? { webSocket: [ws] } : {}),
    },
  },
  blockExplorers: {
    default: { name: 'MonadVision', url: EXPLORER },
  },
})

export function txUrl(hash: `0x${string}` | string): string {
  return `${EXPLORER}/tx/${hash}`
}

export function addressUrl(addr: `0x${string}` | string): string {
  return `${EXPLORER}/address/${addr}`
}
