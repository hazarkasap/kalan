import { createConfig, http, injected } from 'wagmi'
import { monadTestnet, rpcHttp } from './chain.ts'

export const wagmiConfig = createConfig({
  chains: [monadTestnet],
  connectors: [injected()],
  transports: {
    [monadTestnet.id]: http(rpcHttp()),
  },
})
