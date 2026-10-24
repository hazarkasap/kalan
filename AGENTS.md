# Kalan — ajan kuralları (Codex, OpenCode, Cursor, Claude Code)

Tek doğru kaynak `SPEC.md`. Önce onu oku. SPEC dışı özellik ekleme:
kısmi tasfiye, gerçek oracle, çoklu varlık **yok**.

## Klasör sahipliği

| Klasör | Sahip | Not |
| --- | --- | --- |
| `contracts/` | Hazar | Foundry (`foundry-monad` şablonu) |
| `bot/` | Hazar | Node + viem, tek dosya `bot/run.ts` |
| `web/` | Naol | Vite + React + viem (wagmi yalnız cüzdan) |
| `README.md` | Naol (teknik kısım Hazar) | |

Kimse diğerinin klasörüne ajan göndermez. Aynı dosyaya iki ajan dokunmaz.
İki tarafı bağlayan tek şey `deployments.json` ve ABI dosyalarıdır (bkz. SPEC.md).

## Çalışma kuralları

- Tek repo, tek `main` dalı. En az 30 dakikada bir commit (etkinlikte yazılmış kod kanıtı).
- Küçük, doğrulanabilir görevler: "FairLend'e `premiumNow` ekle ve şu 3 testi yaz".
- `contracts/` değişikliğinden sonra `forge test` yeşil olmadan commit yok.
  Matematiği 100 $ / 270 $ örneğiyle elle kontrol et.
- Private key'ler yalnız `.env` içinde; `.env` commit edilmez. Anahtarı sohbete yapıştırma.
  Commit öncesi `git diff` kontrolü.
- Oracle admin anahtarı tarayıcıya gömülmez.
- Monad dokümantasyonu: https://docs.monad.xyz/llms.txt

