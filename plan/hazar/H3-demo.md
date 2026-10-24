# H3 — Demo provası ve ölçüm (14:00–15:15) · OpenCode

## Prompt 1 — demo script

```text
bot/demo.ts yaz: (1) ADMIN_PK (.env) ile resetDemo(), (2) 2 blok bekle, (3) setPrice(2300e18), (4) run.ts'in kazananı loglamasını bekle.
Tek komut: npm run demo. Her çalıştırmanın tx hash'lerini bot/runs/<timestamp>.json'a yaz (gitignore değil, commit'lenecek kanıt).
```

## Prompt 2 — blok süresi ölçümü

```text
bot/measure.ts: son 100 bloğun timestamp'ını oku (getBlock), ortalama blok süresini ms olarak yazdır.
Not: timestamp saniye çözünürlüklü; 100 blokluk farkı 100'e böl. Ayrıca 30 sn boyunca watchBlockNumber
ile yerel saatle ölçüp ikinci bir tahmin ver.
```

- Ölçülen değeri Naol'a gönder (`BLOCK_MS`). "3 blok ≈ X sn" iddiası buna bağlı.
- En az 3 tam prova; 15:15 kod dondurma.
