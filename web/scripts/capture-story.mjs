import { createPublicClient, http, parseEventLogs } from 'viem'
import { readFile, writeFile } from 'node:fs/promises'
const read = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'))
const run = await read('../src/lastRun.json')
const deployments = await read('../src/deployments.json')
const abi = [...await read('../src/abi/FairLend.json'), ...await read('../src/abi/AdminOracle.json')]
const client = createPublicClient({ transport: http(process.env.RPC_URL || 'https://rpc-testnet.monadinfra.com', { timeout: 15000, retryCount: 1 }) })
// Capture only the dashboard's pinned completed run, never mix it with current positions.
const from = BigInt(run.fromBlock) - 90n
const to = BigInt(run.toBlock)
const logs = []
for (let start = from; start <= to; start += 100n) {
  logs.push(...await client.getLogs({ address: [deployments.fairLend, deployments.oracle], fromBlock: start, toBlock: start + 99n < to ? start + 99n : to }))
}
const allEvents = parseEventLogs({ abi, logs }).filter(l => ['PriceSet', 'Flagged', 'Liquidated'].includes(l.eventName)).map(l => ({ event: l.eventName, args: l.args, block: l.blockNumber, tx: l.transactionHash, address: l.address }))
const flag = run.transactions.find(t => t.label === 'flag')
if (!flag) throw new Error('Pinned run has no flag transaction')
const reset = allEvents.filter(e => e.event === 'PriceSet' && e.args.price === 3000n * 10n ** 18n && e.block < BigInt(flag.block)).at(-1)
if (!reset) throw new Error('Missing reset event')
const events = allEvents.filter(e => e.block >= reset.block)
if (events.filter(e => e.event === 'PriceSet').length !== 2 || events.filter(e => e.event === 'Liquidated').length !== 2) throw new Error('Capture must contain one complete comparison run')
const blocks = []
for (let n = BigInt(flag.block); n <= to; n++) {
  const b = await client.getBlock({ blockNumber: n })
  blocks.push({ number: b.number, timestamp: b.timestamp, hash: b.hash })
}
const receipts = []
for (const tx of run.transactions) {
  const r = await client.getTransactionReceipt({ hash: tx.tx })
  if (r.status !== tx.status || r.blockNumber !== BigInt(tx.block)) throw new Error(`Receipt mismatch: ${tx.tx}`)
  receipts.push({ hash: r.transactionHash, block: r.blockNumber, status: r.status })
}
const readContract = (functionName, args = []) => client.readContract({ address: deployments.fairLend, abi, functionName, args, blockNumber: reset.block })
const [fixedPosition, fairPosition, stepBps, thresholdPct] = await Promise.all([
  readContract('positions', [deployments.borrowerFixed]), readContract('positions', [deployments.borrowerFair]),
  readContract('STEP_BPS'), readContract('THRESHOLD_PCT'),
])
const chainId = await client.getChainId()
if (chainId !== deployments.chainId) throw new Error('RPC chain does not match deployments')
const snapshot = { source: 'Read-only RPC capture of web/src/lastRun.json, with decoded contract events, historical positions and receipt verification. Refresh: node scripts/capture-story.mjs', capturedAt: new Date().toISOString(), chainId, deployments, run, positions: { atBlock: reset.block, fixed: fixedPosition, fair: fairPosition }, stepBps, thresholdPct, events, blocks, receipts }
await writeFile(new URL('../src/story/evidence.json', import.meta.url), JSON.stringify(snapshot, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2) + '\n')
console.log(`Captured ${events.length} events, ${blocks.length} timestamps, ${receipts.length} verified receipts`)
