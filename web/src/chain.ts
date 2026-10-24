import { createPublicClient, defineChain, fallback, http, webSocket } from 'viem'

const EXPLORER = 'https://testnet.monadvision.com'
const httpUrl = import.meta.env.VITE_RPC_URL || 'https://rpc-testnet.monadinfra.com'
const wsUrl = import.meta.env.VITE_WS_URL as string | undefined

export const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: {
      http: [httpUrl],
      ...(wsUrl ? { webSocket: [wsUrl] } : {}),
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

export function rpcHttp(): string {
  return import.meta.env.VITE_RPC_URL || 'https://rpc-testnet.monadinfra.com'
}

export function rpcWs(): string | undefined {
  return import.meta.env.VITE_WS_URL
}

export function makePublicClient() {
  const httpUrl = rpcHttp()
  const wsUrl = rpcWs()
  return createPublicClient({
    chain: monadTestnet,
    transport: wsUrl
      ? fallback([webSocket(wsUrl), http(httpUrl)])
      : http(httpUrl),
  })
}

export function makeHttpClient() {
  return createPublicClient({
    chain: monadTestnet,
    transport: http(rpcHttp()),
  })
}
