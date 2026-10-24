# H4 — Teslim (15:15–16:30) · OpenCode

- En iyi çalıştırmanın hash'lerini (`bot/runs/*.json`) seç → README "Demo transactions" için Naol'a ver.
- RPC çökerse video bu hash'lerle kurgulanır.

## Prompt — README teknik kısım

```text
README.md'ye yalnız "## Technical" bölümünü ekle (İngilizce; diğer bölümlere dokunma):
contracts (adresler + monadvision linkleri, deployments.json'dan), premium formula, liquidation math
with the 2000/2300/150bps example, bot design (local premium from Flagged.startBlock, single newHeads
subscription, gas limit = estimate+10%, eth_sendRawTransactionSync), measured block time, how to run
(forge test, forge script ..., cd bot && npm run demo). Simulated parts: oracle and bots are ours.
```

Kontrol: `git log` 12:00 sonrası, `.env` repoda yok, kontratlar doğrulanmış.
