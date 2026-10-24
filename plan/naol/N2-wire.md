# N2 — Wire to chain (13:15–14:00) · Codex + Cursor

**Goal:** replace the mock with real reads/events from Monad testnet. Also get an independent review of Hazar's contract.

Pre-condition: Hazar has pushed `web/src/deployments.json` and `web/src/abi/*.json`. `git pull --rebase` first.

## Prompt A — Codex (event + read layer)

```text
Replace the MOCK inside web/src/data.ts with a real implementation, keeping the same useRun() interface.
Read addresses from web/src/deployments.json. Use viem only (publicClient with webSocket transport from chain.ts,
fall back to http).

- On load: read price() from oracle, positions(borrowerFixed), positions(borrowerFair).
- Load history with getLogs from a reasonable fromBlock (current - 5000) for Flagged, Liquidated (FairLend)
  and PriceSet (oracle), so a visitor WITHOUT a wallet sees the most recent run.
  "Most recent run" = events after the latest PriceSet(3000e18) / resetDemo.
- Subscribe with watchContractEvent for the same three events + watchBlockNumber.
- Right-panel premium: compute locally = min(1000, (currentBlock - startBlock) * 50) bps after Flagged.
  Do NOT call premiumNow every block (RPC limit 25 eth_call/s).
- Map liquidator address -> bot name using deployments.bots [A,B,C].
- Convert 18-decimal bigint to numbers only at the edge (formatUnits). toBorrower is WETH; USD = toBorrower * price.
- Keep USE_MOCK path working when VITE_FAIRLEND is not set.
Show me the diff of data.ts only.
```

## Prompt B — Codex (independent contract review, ~13:30)

Open `contracts/src/FairLend.sol` (read-only) and paste:

```text
Review this Solidity contract for correctness only. Do not rewrite it.
Spec: liquidation threshold 85% (collateralValue * 0.85 < debt). FIXED premium 1000 bps.
FAIR premium = min(1000, (block.number - startBlock) * 50) bps after flag(user).
liquidate: liquidator pays the full debt in USDC, receives min(collateral, debt*(1+premium)/price) WETH,
the rest of the WETH goes to the borrower in the same tx; second liquidate in the same block must revert.
Check with numbers: 1 WETH collateral, 2000 USDC debt, price 2300 (1e18-scaled), premium 150 bps
-> liquidator gets WETH worth 2030 USD, borrower keeps WETH worth 270 USD. With 1000 bps borrower keeps 100.
List concrete bugs (line + why + minimal fix), rounding/decimals issues, reentrancy, access control on
setPrice/resetDemo, and whether the borrower amount can underflow.
```

Send the findings to Hazar (message, not a commit to `contracts/`).

## Prompt C — Cursor (explorer links + loading states)

```text
In the panels: make every tx hash and address a link to testnet.monadvision.com (chain.ts helpers),
show "Waiting for block…" / "Connecting…" states, and an error banner if the RPC fails. Don't change data.ts.
```

## Done when

- [ ] With `VITE_FAIRLEND` set, page shows real price and last run from events
- [ ] Explorer links open the right txs
- [ ] Codex review sent to Hazar
- [ ] Commit + push: `web: read chain state and events`
