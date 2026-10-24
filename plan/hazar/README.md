# Hazar — Ajan görev dosyaları

Sahiplik: `contracts/`, `bot/`. `web/` içinde yalnız `web/src/deployments.json` ve `web/src/abi/*.json` yazılır.
Claude Pro kotası kıt: Claude Code yalnız kontrat + zincir hata ayıklama. Diğer her şey OpenCode.
Her alt görev **yeni ve kısa** bir oturum.

| Dosya | Saat | Araç | Çıktı |
| --- | --- | --- | --- |
| [H0-setup.md](H0-setup.md) | 12:30–12:45 | elle | Foundry projesi, cüzdanlar, `.env` |
| [H1-contracts.md](H1-contracts.md) | 12:45–13:15 | Claude Code + OpenCode | Kontratlar, 3 test, deploy, doğrulama, handoff |
| [H2-bot.md](H2-bot.md) | 13:15–14:00 | OpenCode (+Claude hata ayıklama) | `bot/run.ts`, 3 bot yarışı |
| [H3-demo.md](H3-demo.md) | 14:00–15:15 | OpenCode | `resetDemo` provası, blok süresi ölçümü |
| [H4-ship.md](H4-ship.md) | 15:15–16:30 | OpenCode | Yedek hash'ler, README teknik kısım |

## Bağlam bloğu (her oturumun başına)

```text
Repo: kalan (Monad Blitz Ankara, 4 saatlik hackathon). Önce AGENTS.md ve SPEC.md'yi oku.
Yalnız contracts/ ve bot/ altında çalış; web/ içinde sadece web/src/deployments.json ve web/src/abi/*.json yazılabilir.
SPEC.md "ABI ayrıntısı" bölümü sabit: imzaları değiştirme. SPEC dışı özellik ekleme
(kısmi tasfiye, gerçek oracle, çoklu varlık yok). Private key isteme; .env'den oku.
Küçük adımlar; her adımda değişen dosyaları listele.
```
