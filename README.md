# Kalan

**Liquidations that give back** — tasfiyede borçluya kalanı geri veren ihale. Monad Blitz Ankara v4.

Sabit %10 tasfiye primi yerine prim %0'dan başlar ve her blokta %0,5 artar. İlk kârlı bulan likidatör alır,
fark borçluya kalır: aynı tasfiyede borçluya 100 $ yerine **270 $** kalır.

Spec: [`SPEC.md`](SPEC.md) · Ajan kuralları: [`AGENTS.md`](AGENTS.md)

| Klasör | İçerik |
| --- | --- |
| `contracts/` | Foundry: `FairLend`, `AdminOracle`, `MockERC20` |
| `bot/` | 3 likidatör bot (viem) |
| `web/` | Arayüz (Vite + React + viem) |

Ağ: Monad testnet (chain ID 10143). Addresses: [`web/src/deployments.json`](web/src/deployments.json).

## What is simulated

- **Oracle:** ETH/USD comes from our `AdminOracle`. The admin UI only exposes **Market crash** (`setPrice(2300e18)`) and **Reset demo** (`resetDemo()`, which emits `PriceSet(3000e18)`). Not Chainlink or Pyth.
- **Liquidators:** bots A / B / C are ours (thresholds 1.5%, 2%, 3%).
- **Tokens:** demo USDC and WETH are `MockERC20`. `mint` is **public on purpose** so we can fund the demo. Anyone can mint; this is not a production token.
- Everything else (`flag`, per-block premium, `liquidate`, transfers) is a real Monad testnet transaction.
