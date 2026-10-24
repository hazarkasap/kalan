# H2 — Bot yarışı (13:15–14:00) · OpenCode

## Prompt

```text
bot/run.ts yaz (Node + TypeScript + viem, tek dosya; bot/package.json, tsx ile çalışsın).
- .env: WS_URL (botlar için Naol'dan FARKLI RPC sağlayıcısı), RPC_URL, BOT_A_PK, BOT_B_PK, BOT_C_PK.
- Adresler ve ABI: ../web/src/deployments.json ve ../web/src/abi/FairLend.json.
- Tek webSocket client, tek watchBlockNumber (newHeads). Her blokta premiumNow OKUMA (RPC limiti 25 eth_call/s).
- PriceSet sonrası: borrowerFixed isLiquidatable ise bot A hemen liquidate. borrowerFair için bot A flag(user) gönderir.
- Flagged olayından startBlock'u bir kez al. Her yeni blokta: nextPremium = min(1000,(blockNumber+1-startBlock)*50).
  Bot eşikleri: A 150, B 200, C 300 bps. nextPremium >= eşik olan bot liquidate gönderir (her bot bir kez).
- Gas: estimateGas * 110/100, elle gas limiti. Her bot ayrı wallet client (nonce çakışması yok).
- Makbuz: önce eth_sendRawTransactionSync dene (client.request ile, imzalı raw tx), desteklenmezse
  waitForTransactionReceipt. Revert'leri yakala ve "B reverted" diye logla.
- Log satırı: blok, bot, prim bps, tx hash, status. Çıkışta kazananı yazdır.
- USDC approve'u başlangıçta bir kez yap.
```

Hata ayıklama (revert nedeni, gas, nonce) → Claude Code, kısa oturum.
**14:00:** ilk uçtan uca tasfiye Naol'un ekranında görünmeli. Görünmüyorsa: tek bot (A).
