// Kalan bot yarisi (plan/hazar/H2-bot.md): 3 bot tek dosyada.
// - PriceSet ORACLE adresinden gelir ama ara olay izlemesine gerek yok: her blokta
//   borrowerFixed isLiquidatable OKUMA yeterli; saglarsa bot A hemen liquidate.
// - borrowerFair icin bot A flag(user) gonderir; Flagged olayindan startBlock bir kez alinir.
// - Her yeni blokta: nextPremium = min(1000, (blockNumber+1-startBlock)*50) bps.
//   Esikler: A=150, B=200, C=300 bps; nextPremium >= esik olan bot liquidate gonderir (bir kez).
// - Tx: walletClient.writeContractSync (viem >= 2.57, eth_sendRawTransactionSync; tek cagida makbuz).
//   Hata olursa execute + waitForTransactionReceipt fallback. Revert "REVERT" diye loglanir.
// - Gas: estimateContractGas * 110/100, elle gas parametresi.
// - USDC approve baslangicta her bot icin bir kez.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createPublicClient,
  createWalletClient,
  webSocket,
  http,
  defineChain,
  decodeEventLog,
  type Abi,
  type Address,
  type PublicClient,
  type WalletClient,
  type WebSocketTransport,
} from 'viem'
import { writeContractSync, waitForTransactionReceipt } from 'viem/actions'
import { privateKeyToAccount } from 'viem/accounts'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

// --- .env (repo kokunde: bot/..) ---
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

const BOT_KEYS = [keyOf('BOT_A_PK'), keyOf('BOT_B_PK'), keyOf('BOT_C_PK')]

// --- adresler ve ABI (web'ten tek kaynak; duz array JSON) ---
const deployments = JSON.parse(readFileSync(resolve(root, 'web/src/deployments.json'), 'utf8')) as {
  fairLend: Address
  oracle: Address
  usdc: Address
  weth: Address
  borrowerFixed: Address
  borrowerFair: Address
  chainId: number
}
const fairLendAbi = JSON.parse(readFileSync(resolve(root, 'web/src/abi/FairLend.json'), 'utf8')) as Abi
const erc20Abi = JSON.parse(readFileSync(resolve(root, 'web/src/abi/MockERC20.json'), 'utf8')) as Abi

const FAIRLEND = deployments.fairLend
const USDC = deployments.usdc
const BORROWER_FIXED = deployments.borrowerFixed
const BORROWER_FAIR = deployments.borrowerFair

const monad = defineChain({
  id: deployments.chainId, // 10143
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL], webSocket: [WS_URL] } },
  blockExplorers: { default: { name: 'MonadVision', url: 'https://testnet.monadvision.com' } },
})

// --- clients: tek WS transport; her bot ayri wallet (nonce cakismasi yok) ---
const transport = webSocket(WS_URL, { retryCount: 5, timeout: 20_000 })
const publicClient: PublicClient<WebSocketTransport> = createPublicClient({ chain: monad, transport })
const botAccounts = BOT_KEYS.map((k) => privateKeyToAccount(k))
const botClients: WalletClient<WebSocketTransport>[] = botAccounts.map(
  (account) => createWalletClient({ account, chain: monad, transport }),
)

// --- sabitler (FairLend.sol ile ayni) ---
const STEP_BPS = 50n
const MAX_BPS = 1000n
const THRESHOLD_BPS = [150n, 200n, 300n] // A=150, B=200, C=300
const BOT_NAMES = ['A', 'B', 'C']

const win = (n: bigint): bigint => (n > MAX_BPS ? MAX_BPS : n)

function log(msg: string) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`)
}

type BotCall = {
  address: Address
  abi: Abi
  functionName: string
  args: readonly unknown[]
}

type SyncReceipt = { transactionHash: `0x${string}`; status: 'success' | 'reverted'; blockNumber: bigint }

// Tek cagida gonder + makbuz (writeContractSync -> eth_sendRawTransactionSync;
// Monad iki RPC de destekliyor). Desteklenmezse execute + waitForTransactionReceipt.
// fixedGas verilmisse estimateContractGas KULLANMA (revert edecek cagrilar icin;
// estimate simule edip basarir, makbuz donmez).
async function sendSync(botIdx: number, call: BotCall, fixedGas?: bigint): Promise<SyncReceipt> {
  const client = botClients[botIdx]
  const account = botAccounts[botIdx]

  const gas = fixedGas ?? (await publicClient.estimateContractGas({
    address: call.address,
    abi: call.abi,
    functionName: call.functionName,
    args: call.args,
    account: account.address,
  } as never)) * 110n / 100n
  const callWithGas: Record<string, unknown> = {
    address: call.address,
    abi: call.abi,
    functionName: call.functionName,
    args: call.args,
    account: account.address,
    gas,
  }

  try {
    // viem >= 2.57 writeContractSync: imzali tx'i eth_sendRawTransactionSync ile gonderir,
    // makbuzu tek cagida doner. NOT: account tam hesap nesnesi olmali (string adres
    // parseAccount'ta json-rpc tipine dusup eth_sendTransaction'a gidiyor).
    return await writeContractSync(client, { ...callWithGas, account } as never)
  } catch (err) {
    const msg = String(err)
    // sync desteklenmiyorsa normal yol + makbuz
    if (!/sync|sendRawTransactionSync|not found|-32601|unsupported/i.test(msg)) throw err
    const hash = await client.writeContract({ ...callWithGas, account } as never)
    const receipt = await waitForTransactionReceipt(publicClient, { hash } as never)
    return { transactionHash: hash, status: receipt.status, blockNumber: receipt.blockNumber }
  }
}

async function botSend(botIdx: number, call: BotCall, label: string, fixedGas?: bigint): Promise<boolean> {
  const name = BOT_NAMES[botIdx]
  try {
    const r = await sendSync(botIdx, call, fixedGas)
    raceTx.push({
      bot: name,
      label,
      tx: r.transactionHash,
      status: r.status,
      premiumBps: call.functionName === 'liquidate' ? premiumLabel(label) : '-',
      block: r.blockNumber.toString(),
    })
    if (r.status === 'reverted') {
      log(`${label} bot=${name} tx=${r.transactionHash} status=reverted  (bot ${name} reverted)`)
      return false
    }
    log(`${label} bot=${name} tx=${r.transactionHash} status=success`)
    return true
  } catch (err) {
    log(`${label} bot=${name} HATA: ${shortErr(err)}`)
    return false
  }
}

function premiumLabel(label: string): string {
  const m = label.match(/(\d+)bps/)
  return m ? m[1] : label.includes('fixed') ? '1000' : '-'
}

function shortErr(err: unknown): string {
  const s = String(err)
  const m = s.match(/reverted[^\n]*/i)
  return (m ? m[0] : s).slice(0, 160)
}

// --- durum ---
let sentFixed = false
let sentFlag = false
let startBlock: bigint | null = null // Flagged olayindan bir kez alinir
const sentFair = [false, false, false]
let raceDone = false
let busy = false // onBlock yeniden giris korumasi (viem onBlock'u await etmez, pingpongf yapar)

// Yarisi kaydi: konsol ozeti + bot/runs/<ISO>.json
type RaceRecord = { bot: string; label: string; tx: string; status: string; premiumBps: string; block: string }
const raceTx: RaceRecord[] = []

async function writeRaceFile(summary: Record<string, unknown>) {
  try {
    const dir = resolve(here, 'runs')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const iso = new Date().toISOString().replace(/[:.]/g, '-')
    writeFileSync(resolve(dir, `${iso}.json`), JSON.stringify(summary, null, 2))
    log(`ozet yazildi: bot/runs/${iso}.json`)
  } catch (err) {
    log(`runs dosyasi yazilamadi: ${shortErr(err)}`)
  }
}

async function main() {
  log(`kalan-bot start fairLend=${FAIRLEND} fixed=${BORROWER_FIXED} fair=${BORROWER_FAIR}`)

  // 1) USDC approve: baslangicta her bot icin bir kez
  for (let i = 0; i < 3; i++) {
    const allowance = (await publicClient.readContract({
      address: USDC,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [botAccounts[i].address, FAIRLEND],
    })) as bigint
    if (allowance >= 10000n * 10n ** 18n) {
      log(`approve ok bot=${BOT_NAMES[i]}`)
      continue
    }
    await botSend(
      i,
      { address: USDC, abi: erc20Abi, functionName: 'approve', args: [FAIRLEND, 2n ** 256n - 1n] },
      'approve',
    )
  }

  // 2) Fair pozisyon zaten flagged ise startBlock'u positions'dan yakala,
  //    degilse Flagged olayini bekle.
  const pos = (await publicClient.readContract({
    address: FAIRLEND,
    abi: fairLendAbi,
    functionName: 'positions',
    args: [BORROWER_FAIR],
  })) as [bigint, bigint, number, bigint]
  if (pos[3] !== 0n) {
    startBlock = pos[3]
    log(`zaten flagged: startBlock=${pos[3]}`)
  }

  // 3) Flagged olayini dinle: startBlock bir kez alinir.
  publicClient.watchContractEvent({
    address: FAIRLEND,
    abi: fairLendAbi,
    eventName: 'Flagged',
    onLogs: (logs) => {
      for (const l of logs) {
        const ev = decodeEventLog({
          abi: fairLendAbi,
          data: l.data,
          topics: l.topics,
        }) as { eventName: string; args: { user?: string; startBlock?: bigint } }
        if (ev.args.user?.toLowerCase() !== BORROWER_FAIR.toLowerCase()) continue
        if (startBlock === null && ev.args.startBlock) {
          startBlock = ev.args.startBlock
          log(`Flagged: user=${ev.args.user} startBlock=${ev.args.startBlock}`)
        }
      }
    },
    onError: (err) => log(`Flagged dinleme hata: ${shortErr(err)}`),
  })

  // 4) newHeads: tek webSocket client, tek watchBlockNumber.
  await publicClient.watchBlockNumber({
    onBlockNumber: async (blockNumber) => {
      try {
        await onBlock(blockNumber)
      } catch (err) {
        log(`onBlock hata: ${shortErr(err)}`)
      }
    },
    onError: (err) => log(`watchBlockNumber hata: ${shortErr(err)}`),
  })
  log('newHeads dinleniyor...')
}

async function readBool(fn: 'isLiquidatable', user: Address): Promise<boolean> {
  return (await publicClient.readContract({
    address: FAIRLEND,
    abi: fairLendAbi,
    functionName: fn,
    args: [user],
  })) as boolean
}

async function onBlock(blockNumber: bigint) {
  if (raceDone || busy) return
  busy = true
  try {
    // a) PriceSet sonrasi: borrowerFixed isLiquidatable ise bot A hemen liquidate (bir kez)
    if (!sentFixed && (await readBool('isLiquidatable', BORROWER_FIXED))) {
      log(`fixed liquidatable @block ${blockNumber} -> bot A liquidate`)
      sentFixed = true // in-flight guard
      const ok = await botSend(
        0,
        { address: FAIRLEND, abi: fairLendAbi, functionName: 'liquidate', args: [BORROWER_FIXED] },
        'fixed-liquidate',
      )
      if (!ok) sentFixed = false
    }

    // b) borrowerFair liquidatable ise bot A flag gonderir (bir kez)
    if (startBlock === null) {
      if (!(await readBool('isLiquidatable', BORROWER_FAIR))) return
      const pos = (await publicClient.readContract({
        address: FAIRLEND,
        abi: fairLendAbi,
        functionName: 'positions',
        args: [BORROWER_FAIR],
      })) as [bigint, bigint, number, bigint]
      if (pos[3] !== 0n) {
        startBlock = pos[3]
        log(`flagged bulundu: startBlock=${pos[3]} @block ${blockNumber}`)
      } else if (!sentFlag) {
        log(`fair liquidatable @block ${blockNumber} -> bot A flag`)
        sentFlag = true // in-flight guard
        const ok = await botSend(
          0,
          { address: FAIRLEND, abi: fairLendAbi, functionName: 'flag', args: [BORROWER_FAIR] },
          'flag',
        )
        if (!ok) sentFlag = false
      }
      return
    }

    // c) fair yarisi: nextPremium = min(1000, (blockNumber+1-startBlock)*50) bps,
    //    esigi gecen bot liquidate gonderir. A kazansa bile B ve C kendi esiklerinde
    //    deneyip revert makbuzu alir (kanit icin hoban zaman zin kac blok sonra ozet + exit).
    const nextPremium = win((blockNumber + 1n - startBlock) * STEP_BPS)
    for (let i = 0; i < 3; i++) {
      if (sentFair[i] || nextPremium < THRESHOLD_BPS[i]) continue
      log(`esik asildi: bot=${BOT_NAMES[i]} nextPremium=${nextPremium}bps @block ${blockNumber}`)
      sentFair[i] = true // in-flight guard
      // B/C denemesi revert olacak; estimate hataya dusmesin diye sabit 200_000 gas.
      const fixedGas = i === 0 ? undefined : 200_000n
      const ok = await botSend(
        i,
        { address: FAIRLEND, abi: fairLendAbi, functionName: 'liquidate', args: [BORROWER_FAIR] },
        `fair-liquidate(${nextPremium}bps)`,
        fixedGas,
      )
      if (ok && i === 0) {
        console.log('==================================================')
        console.log(`KAZANAN: bot ${BOT_NAMES[i]} | prim=${nextPremium}bps | block=${blockNumber}`)
        console.log('==================================================')
        // B/C esiklerine kadar bekle (200/300 bps), sonra C denemesinden sonra ozet + exit.
      }
    }
    // Ozet: A kazandigi (sentFair[0]) ve C'nin denemesi gorundugu anda yazdir.
    if (sentFair[2] && !raceDone) {
      raceDone = true
      await printSummary()
      process.exit(0)
    }
  } finally {
    busy = false
  }
}

async function printSummary() {
  const winnerRec = raceTx.find((r) => r.status === 'success' && /fixed-liquidate|fair-liquidate/.test(r.label))
  console.log('==================================================')
  console.log('YARIS OZETI')
  console.log(`startBlock: ${startBlock}`)
  for (const r of raceTx) {
    console.log(`  bot=${r.bot} ${r.label} premium=${r.premiumBps}bps block=${r.block} status=${r.status} tx=${r.tx}`)
  }
  if (winnerRec) console.log(`KAZANAN: bot ${winnerRec.bot}`)
  console.log('==================================================')
  await writeRaceFile({
    finishedAt: new Date().toISOString(),
    startBlock: startBlock?.toString(),
    winner: winnerRec?.bot ?? null,
    transactions: raceTx,
  })
}

main().catch((err) => {
  log(`fatal: ${shortErr(err)}`)
  process.exit(1)
})
