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

Ağ: Monad testnet (chain ID 10143). Kontrat adresleri ve demo tx hash'leri deploy sonrası eklenecek.
