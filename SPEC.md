# Kalan — SPEC

*Liquidations that give back* · Monad Blitz Ankara v4 (24 Ekim 2026)

Borç tasfiyesinde sabit %10 prim yerine %0'dan başlayıp her blokta artan prim.
İlk kârlı bulan likidatör alır, fark borçluya kalır.

**Manşet:** aynı tasfiyede borçluya sabit primle 100 $, Kalan ile 270 $ kalır; ihale ~3 blokta biter.

## Mekanizma

1. Borçlu WETH yatırır, USDC borç alır. Pozisyon modu açılışta seçilir: `FIXED` veya `FAIR`.
2. Teminat değerinin %85'i borcun altına düşünce pozisyon tasfiye edilebilir.
3. `FIXED`: ilk bot hemen `liquidate` çağırır, prim %10.
4. `FAIR`: biri `flag(user)` çağırır; kontrat sağlıksızlığı kontrol eder, `startBlock` kaydeder.
   Prim her blokta %0,5 artar, tavan %10.
5. `liquidate(user)`: likidatör borcu USDC ile öder, `borç × (1 + prim) / fiyat` kadar WETH alır,
   kalan WETH aynı işlemde borçluya gider. Pozisyon kapanır; aynı bloktaki ikinci deneme revert.

## Parametreler

| Ad | Değer |
| --- | --- |
| Tasfiye eşiği | %85 (teminat değeri × 0,85 < borç) |
| Prim adımı | 50 bps / blok |
| Prim tavanı | 1.000 bps (%10) |
| FIXED prim | 1.000 bps |
| Demo başlangıç fiyatı | 3.000 $ |
| Demo çöküş fiyatı | 2.300 $ |
| Demo pozisyon | 1 WETH teminat, 2.000 USDC borç |

**Kontrol örneği (fiyat 2.300 $, borç 2.000 $):**

| | FIXED %10 | FAIR %1,5 |
| --- | --- | --- |
| Likidatörün ödediği | 2.000 $ | 2.000 $ |
| Likidatörün aldığı WETH değeri | 2.200 $ | 2.030 $ |
| Borçluya kalan | 100 $ | 270 $ |

## Tasarım kuralları

- `premiumNow = min(1000, (block.number − startBlock) × 50)` bps. **Blok numarası**, `block.timestamp` değil.
- Prim işlemin girdiği bloğa göre hesaplanır; botlar *bir sonraki bloğun* primini hesaplar.
- Likidatöre giden WETH = `min(teminat, borç × (1 + prim) / fiyat)`; borçluya kalan negatif olamaz.
- `resetDemo()` (yalnız admin): fiyatı 3.000 $'a çeker, FIXED ve FAIR borçlu pozisyonlarını yeniden açar.
  Borçlu işlemlerini admin adına yapar; borçlulara MON gerekmez.
- `FairLend` ≤ 150 satır. En az 3 `forge test`: FIXED %10 kapanış, FAIR %1,5 kapanış,
  aynı blokta ikinci `liquidate` revert.

## Kontratlar

| Kontrat | Görev | Fonksiyonlar |
| --- | --- | --- |
| `MockERC20` (×2) | Test USDC ve WETH | `mint(to, amount)` |
| `AdminOracle` | ETH fiyatı; yalnız admin değiştirir | `setPrice(p)`, `price()` |
| `FairLend` | Teminat, borç, sağlık kontrolü, iki tasfiye modu | `deposit`, `borrow`, `flag(user)`, `premiumNow(user)`, `liquidate(user)`, `positions(user)`, `resetDemo()` |

### Olaylar

```solidity
event Flagged(address indexed user, uint256 startBlock);
event Liquidated(address indexed user, address indexed liquidator, uint256 premiumBps,
                 uint256 toLiquidator, uint256 toBorrower, uint256 blockNumber);
event PriceSet(uint256 price); // AdminOracle
```

Arayüz bütün rakamları bu olaylardan okur; ayrı veritabanı yok.

## Arayüz sözleşmesi (12:15'te sabit)

`deployments.json` (`web/src/` altına kopyalanır, ABI'lerle birlikte):

```json
{ "chainId": 10143, "fairLend": "0x…", "oracle": "0x…", "usdc": "0x…", "weth": "0x…",
  "borrowerFixed": "0x…", "borrowerFair": "0x…", "bots": ["0xA…", "0xB…", "0xC…"] }
```

- Okunan fonksiyonlar: `price()`, `positions(user)`, `premiumNow(user)`
- Okunan olaylar: `Flagged`, `Liquidated`, `PriceSet`
- Yazılan işlemler (yalnız admin cüzdanı bağlıyken): `setPrice(2300)`, `resetDemo()`
- Admin bağlı değilken sayfa "son çalıştırma"yı olaylardan okuyarak gösterir.

## Bot (`bot/run.ts`)

- 3 likidatör, ayrı cüzdan ve private key: A %1,5, B %2, C %3 eşik.
- `startBlock`'u bir kez `Flagged` olayından al; primi yerelde blok numarasından hesapla.
  Tek WebSocket `newHeads` aboneliği. Her blokta `premiumNow` **okuma** (RPC limiti).
- Gas limiti elle ve dar: `estimateGas` + %10 (Monad gas limitinden ücret alır).
- Makbuz: `eth_sendRawTransactionSync`, desteklenmezse makbuz yoklaması.
- Bot cüzdanlarını EIP-7702 ile delege etme.

## Ağ

| Alan | Değer |
| --- | --- |
| Chain ID | 10143 (Monad testnet) |
| RPC (QuickNode, 50 rps) | `https://testnet-rpc.monad.xyz` · `wss://testnet-rpc.monad.xyz` |
| RPC (Monad Foundation, 20 rps) | `https://rpc-testnet.monadinfra.com` · `wss://rpc-testnet.monadinfra.com` |
| RPC (Ankr) | `https://rpc.ankr.com/monad_testnet` |
| Explorer | `testnet.monadvision.com`, `testnet.monadscan.com` |

Botlar ve arayüz farklı RPC sağlayıcısı kullanır.

## Deploy

```sh
forge script script/Deploy.s.sol --rpc-url $RPC --account deployer --broadcast
forge verify-contract <adres> <Ad> --chain 10143 --verifier sourcify \
  --verifier-url https://sourcify-api-monad.blockvision.org
```

Deploy sırası: 2× `MockERC20` → `AdminOracle(3000)` → `FairLend(oracle, usdc, weth)` →
protokole USDC likiditesi → botlara USDC → `resetDemo()` → `deployments.json`.

## Kapsam dışı

Kısmi tasfiye, gerçek oracle (Chainlink/Pyth), çoklu varlık, açık likidatör ağı.
Oracle ve botlar bizim; diğer her şey gerçek zincir işlemi.
