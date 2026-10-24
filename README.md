# Kalan

**Liquidations that give back** — *tasfiyede borçluya kalanı geri veren ihale.* Built at Monad Blitz Ankara v4 (Oct 24, 2026).

Lending protocols pay liquidators a fixed bonus (5–15%) out of the borrower's collateral, even when a much smaller
bonus would have been enough. Kalan replaces the fixed bonus with a **per-block rising premium**: it starts at 0% and
grows 0.5% every block (capped at 10%). The first liquidator who finds it profitable takes the position; whatever is
left goes back to the borrower in the same transaction.

| Same liquidation (1 WETH collateral, 2,000 USDC debt, ETH $3,000 → $2,300) | Fixed 10% bonus | Kalan |
| --- | --- | --- |
| Liquidator repays | $2,000 | $2,000 |
| Liquidator receives (WETH value) | $2,200 | $2,030 |
| **Borrower keeps** | **$100** | **$270** |
| Time | 1 tx | 3 blocks ≈ 0.9 s |

**Live demo:** https://kalan-umber.vercel.app — opens without a wallet and shows the last run from on-chain events.

## Why Monad

A rising-premium auction has a trade-off: if the premium rises too slowly, the protocol carries bad-debt risk while
the price keeps falling; if it rises too fast, the borrower gets little back. Protocols pick a fixed bonus to dodge it.
With ~0.3 s blocks the auction is both fine-grained and fast: reaching 1.5% takes 3 blocks ≈ 0.9 s on Monad versus
3 × 12 s = 36 s on Ethereum L1.

## How it works

1. `resetDemo()` opens two identical positions: one `FIXED`, one `FAIR` (1 WETH, 2,000 USDC debt, price $3,000).
2. Admin crashes the oracle to $2,300. Both positions fall below the 85% threshold (`1 × 2300 × 0.85 = 1955 < 2000`).
3. `FIXED`: bot A calls `liquidate` immediately and is paid the flat 10% → borrower keeps $100.
4. `FAIR`: bot A calls `flag(user)`; the contract records `startBlock`. The premium is now
   `min(1000, (block.number − startBlock) × 50)` bps.
5. Bots A / B / C wait for 1.5% / 2% / 3%. A gets in at 1.5% → borrower keeps $270. B and C arrive later and revert.

Spec: [`SPEC.md`](SPEC.md) · Agent rules: [`AGENTS.md`](AGENTS.md)

| Folder | Content |
| --- | --- |
| `contracts/` | Foundry: `FairLend`, `AdminOracle`, `MockERC20` + tests and deploy script |
| `bot/` | Three liquidator bots and the admin crash/reset tool (Node + viem) |
| `web/` | Demo UI (Vite + React + viem) |

## Contracts (Monad testnet, chain ID 10143, verified on Sourcify)

| Contract | Address |
| --- | --- |
| `FairLend` | [`0xCd4E8f8bB1e5d96C444b28a6F6090a64E898aBE9`](https://testnet.monadvision.com/address/0xCd4E8f8bB1e5d96C444b28a6F6090a64E898aBE9) |
| `AdminOracle` | [`0xf4831fee37FC5B0433E4C1F8B0370316658C607a`](https://testnet.monadvision.com/address/0xf4831fee37FC5B0433E4C1F8B0370316658C607a) |
| USDC (`MockERC20`) | [`0x8E37f27B65b0F278bA657f9390B47362A5FAc701`](https://testnet.monadvision.com/address/0x8E37f27B65b0F278bA657f9390B47362A5FAc701) |
| WETH (`MockERC20`) | [`0xbB0C8A10f1A61ba7A0Aa02896A612935bfb9D542`](https://testnet.monadvision.com/address/0xbB0C8A10f1A61ba7A0Aa02896A612935bfb9D542) |

All addresses: [`web/src/deployments.json`](web/src/deployments.json).

## Demo transactions (run used in the video)

| Step | Block | Premium | Tx |
| --- | --- | --- | --- |
| `resetDemo()` — price $3,000, positions open | 73807405 | | [`0xf28e…f591`](https://testnet.monadvision.com/tx/0xf28e348a7deab68036e2b38606f2cb88e7482dc94da7994237b5a514db4ff591) |
| Market crash — `setPrice(2300e18)` | 73807427 | | [`0x94fe…3956`](https://testnet.monadvision.com/tx/0x94fe316aa3bf16f263d2eec85b27e167d207ca5723139bf5a8ad51bd8ce33956) |
| Bot A liquidates `FIXED` → borrower keeps $100 | 73807429 | 10% | [`0x6bff…b2f5`](https://testnet.monadvision.com/tx/0x6bff591a354544bbab1685e8b85814ed387e53984fe74bb6fd370f7b3ebbb2f5) |
| Bot A flags `FAIR` (`startBlock`) | 73807431 | 0% | [`0xaf0d…1e6c`](https://testnet.monadvision.com/tx/0xaf0d2fb3ed48c3f0eb055af2d01e47ceefd3a4264915718f9e2cce2083531e6c) |
| **Bot A liquidates `FAIR` → borrower keeps $270** | 73807434 | **1.5%** | [`0xf103…40d1`](https://testnet.monadvision.com/tx/0xf103dd7cc7782eb9b442170af54d5210937ec1752be35ddea28f5bd86ece40d1) |
| Bot B tries — reverts (already liquidated) | 73807437 | 3.0% | [`0x67c8…918e`](https://testnet.monadvision.com/tx/0x67c888ab612a019d748fb399daf9be862877d432f14c09c8b2947dd512f5918e) |
| Bot C tries — reverts (already liquidated) | 73807438 | 3.5% | [`0xe680…b79d`](https://testnet.monadvision.com/tx/0xe680dfdda19331f4a93ffddf8ce0f203de307046e3d0d6826dc7edb3cd47b79d) |

Full record: [`bot/runs/2026-10-24T11-56-14-553Z.json`](bot/runs/2026-10-24T11-56-14-553Z.json).

## What is simulated

- **Oracle:** ETH/USD comes from our `AdminOracle`. The admin UI only exposes **Market crash** (`setPrice(2300e18)`) and **Reset demo** (`resetDemo()`, which emits `PriceSet(3000e18)`). Not Chainlink or Pyth.
- **Liquidators:** bots A / B / C are ours (thresholds 1.5%, 2%, 3%).
- **Tokens:** demo USDC and WETH are `MockERC20`. `mint` is **public on purpose** so we can fund the demo. Anyone can mint; this is not a production token.
- Everything else (`flag`, per-block premium, `liquidate`, transfers) is a real Monad testnet transaction.

Known limits: no partial liquidation (a position closes in one go), a fixed 0.5%/block premium step (not tuned to
market volatility), one collateral asset.

## Technical

**Premium.** `premiumNow = min(1000, (block.number − startBlock) × 50)` bps — block number, not `block.timestamp`
(Monad timestamps are whole seconds and repeat across sub-second blocks).

**Liquidation math** (`FairLend.liquidate`):

```
toLiquidator = min(collateral, debt × (10000 + premiumBps) / 10000 × 1e18 / price)
toBorrower   = collateral − toLiquidator          // cannot underflow after the clamp
```

Worked example at price 2300e18, debt 2000e18, 150 bps: `2000 × 1.015 / 2300 = 0.88261 WETH` to the liquidator
($2,030), `0.11739 WETH` ($270) to the borrower. At 1000 bps: `0.95652 WETH` ($2,200) and $100. The position is
deleted before transfers (checks-effects-interactions); a second `liquidate` in the same or a later block reverts
with `Healthy()` because the position is gone. Tokens are 18 decimals; the price is 1e18-scaled USD.

**Bots** (`bot/run.ts`, one process, three wallets):

- One WebSocket `newHeads` subscription. `startBlock` is read once from the `Flagged` event; the premium is computed
  locally from the block number instead of calling `premiumNow` every block (RPC limit 25 `eth_call`/s).
- A tx sent after seeing block N lands in N+1 or N+2 (measured). Bots fire when
  `premiumAt(N + 2) ≥ threshold`, so the borrower gets at least the 1.5% outcome ($270) and sometimes 1.0% ($280).
- Fixed gas limit (200,000) for race transactions: Monad charges the gas *limit*, and `estimateGas` would fail for
  the losers whose call is expected to revert. Receipts come back in one call via `eth_sendRawTransactionSync`
  (viem `writeContractSync`).
- Separate wallets per bot (no nonce collisions); bots top up demo USDC themselves and warn on low MON.
- Bots and UI use different RPC providers (QuickNode for bots, Monad Foundation for the UI).

**Measured block time:** 305 ms (timestamps over 1,000 blocks), 324 ms (wall clock over 30 s of `newHeads`). The UI
shows its own average over the last ~200 blocks.

**UI.** Everything on screen is derived from `PriceSet` / `Flagged` / `Liquidated` events, bot transactions and their
receipts; losing bots' revert reasons are decoded with `debug_traceTransaction`. `eth_getLogs` is capped at 100 blocks
on Monad RPCs, so the page walks back in 100-block chunks; if the last run is older than ~12k blocks it walks back from
[`web/src/lastRun.json`](web/src/lastRun.json), which the bot writes after every successful run.

## Run it

```sh
# contracts
cd contracts && forge test                 # 6 tests: FIXED 10%, FAIR 1.5% → $270, same-block revert, cap, flag-when-healthy, access
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast   # needs ADMIN_PK etc. in ../.env

# bots (repo-root .env: RPC_URL, WS_URL, ADMIN_PK, BOT_{A,B,C}_PK, BORROWER_{FIXED,FAIR}_ADDR — see .env.example)
cd bot && npm install
npx tsx crash.ts reset        # price back to $3,000, both positions reopened
npx tsx run.ts                # terminal 1: bots listen
npx tsx crash.ts crash        # terminal 2: price → $2,300, race starts

# UI
cd web && npm install && npm run dev
```

## Team

- **Hazar Kasap** — contracts, bots, deployment
- **Naol** — UI, video
