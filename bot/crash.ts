// Kalan admin crash araci: ADMIN_PK ile oracle.setPrice(2300e18) gonderir (tek dosya).
// setPrice(3000e18) ASLA elle cagrilamaz; geri almak icin fairLend.resetDemo() (ADMIN_PK).
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createPublicClient,
  createWalletClient,
  webSocket,
  http,
  defineChain,
  formatEther,
  encodeFunctionData,
  parseAbi,
  type Abi,
  type Address,
} from 'viem'
import { sendTransactionSync, waitForTransactionReceipt, writeContract } from 'viem/actions'
import { privateKeyToAccount } from 'viem/accounts'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

for (const line of readFileSync(resolve(root, '.env'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}

const RPC_URL = process.env.RPC_URL
const WS_URL = process.env.WS_URL
if (!RPC_URL || !WS_URL) throw new Error('.env: RPC_URL / WS_URL eksik')

function keyOf(name: string): `0x${string}` {
  const raw = (process.env[name] ?? '').trim()
  const k = (raw.startsWith('0x') ? raw : `0x${raw}`) as `0x${string}`
  if (k.length !== 66) throw new Error(`.env: ${name} gecersiz`)
  return k
}

const ADMIN_PK = keyOf('ADMIN_PK')
const deployments = JSON.parse(readFileSync(resolve(root, 'web/src/deployments.json'), 'utf8')) as {
  fairLend: Address
  oracle: Address
  chainId: number
}
const oracleAbi = JSON.parse(readFileSync(resolve(root, 'web/src/abi/AdminOracle.json'), 'utf8')) as Abi
const fairLendAbi = JSON.parse(readFileSync(resolve(root, 'web/src/abi/FairLend.json'), 'utf8')) as Abi

const ORACLE = deployments.oracle
const FAIRLEND = deployments.fairLend

const monad = defineChain({
  id: deployments.chainId,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: 'MonadVision', url: 'https://testnet.monadvision.com' } },
})

const publicClient = createPublicClient({ chain: monad, transport: http(RPC_URL) })
const account = privateKeyToAccount(ADMIN_PK)
const adminClient = createWalletClient({ account, chain: monad, transport: webSocket(WS_URL) })

const target = process.argv[2] === 'reset' ? 'reset' : 'crash'

async function sendAndWait(
  call: { address: Address; abi: Abi; functionName: string; args: readonly unknown[] },
  label: string,
) {
  const to = call.address
  const data = encodeFunctionData({ abi: call.abi, functionName: call.functionName, args: call.args as never })
  const gas = await publicClient.estimateGas({ account: account.address, to, data })
  const callRaw = { to, data, gas: (gas * 110n) / 100n }
  try {
    // eth_sendRawTransactionSync: tek cagida makbuz (Monad WS destekliyor)
    const receipt = await sendTransactionSync(adminClient, callRaw as never)
    console.log(`${label} tx=${receipt.transactionHash} status=${receipt.status}`)
  } catch (err) {
    const msg = String(err)
    if (!/sync|sendRawTransactionSync|not supported|-32601|unsupported/i.test(msg)) throw err
    // fallback: normal yol + makbuz
    const hash = await adminClient.writeContract(
      { ...call, account: account.address, gas: (gas * 110n) / 100n } as never,
    )
    const receipt = await waitForTransactionReceipt(publicClient, { hash } as never)
    console.log(`${label} tx=${hash} status=${receipt.status}`)
  }
}

switch (target) {
  case 'crash': {
    const price = 2300n * 10n ** 18n
    console.log(`crash: setPrice(${formatEther(price)} USD)`)
    await sendAndWait(
      { address: ORACLE, abi: oracleAbi, functionName: 'setPrice', args: [price] },
      'setPrice',
    )
    break
  }
  case 'reset': {
    console.log('reset: fairLend.resetDemo() (price -> 3000, pozisyonlar yeniden acilir)')
    await sendAndWait(
      { address: FAIRLEND, abi: fairLendAbi, functionName: 'resetDemo', args: [] },
      'resetDemo',
    )
    break
  }
}

const now = (await publicClient.readContract({
  address: ORACLE,
  abi: oracleAbi,
  functionName: 'price',
  args: [],
})) as bigint
console.log(`oracle.price() = $${formatEther(now)}`)
process.exit(0)
