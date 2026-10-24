# H1 — Kontratlar, test, deploy (12:45–13:15)

## Prompt 1 — Claude Code: kontratlar + testler

```text
contracts/src altında SPEC.md'ye birebir uyan üç kontrat yaz: MockERC20 (18 ondalık, herkese açık mint),
AdminOracle (admin, price 1e18 ölçekli, setPrice onlyAdmin, PriceSet olayı), FairLend.
FairLend: positions(user) -> (collateral, debt, mode, startBlock); mode 1 FIXED, 2 FAIR.
isLiquidatable: collateral*price/1e18 * 85 / 100 < debt. flag(user): yalnız FAIR, sağlıksızsa ve startBlock==0 ise
startBlock=block.number, Flagged olayı. premiumNow: FIXED 1000; FAIR flag'liyse min(1000,(block.number-startBlock)*50), değilse 0.
liquidate(user): sağlıksız olmalı; FAIR ise flag'li olmalı; likidatör debt kadar USDC öder;
toLiq = min(collateral, debt*(10000+prem)/10000 *1e18/price); toBorrower = collateral-toLiq; pozisyon silinir;
Liquidated(user, msg.sender, prem, toLiq, toBorrower, block.number). Aynı blokta ikinci çağrı pozisyon kapalı olduğu için revert.
resetDemo() onlyAdmin: oracle fiyatını 3000e18 yapar (FairLend oracle'ın admin'i olmalı ya da oracle FairLend'e yetki verir —
basit olanı seç ve açıkla), borrowerFixed (FIXED) ve borrowerFair (FAIR) için 1 WETH mint+yatır, 2000 USDC borç kaydı açar.
FairLend ≤150 satır. CEI sırası, reentrancy yok.
Testler (contracts/test/FairLend.t.sol): (1) FIXED fiyat 2300'de 1000 bps, borçluya ~100$ değerinde WETH;
(2) FAIR flag + 3 blok (vm.roll) -> 150 bps, borçluya ~270$; (3) aynı blokta ikinci liquidate revert.
forge test çalıştır ve çıktıyı göster.
```

Elle kontrol: 2000×1,015/2300 = 0,88261 WETH → likidatör; 0,11739 WETH × 2300 = **270 $**. ✔ olmadan commit yok.

## Prompt 2 — OpenCode: deploy script

```text
contracts/script/Deploy.s.sol yaz: 2x MockERC20 (USDC, WETH) -> AdminOracle(3000e18) -> FairLend(oracle, usdc, weth,
borrowerFixed, borrowerFair) -> oracle yetkisini FairLend'e ver (H1 tasarımına göre) -> FairLend'e 1_000_000 USDC mint
-> .env'deki 3 bot adresine 10_000 USDC mint -> resetDemo().
Adresleri vm.writeJson ile ../web/src/deployments.json'a yaz:
{chainId, fairLend, oracle, usdc, weth, borrowerFixed, borrowerFair, bots:[A,B,C]}.
Ayrıca out/ altındaki FairLend ve AdminOracle ABI'lerini web/src/abi/ altına kopyalayan küçük bir shell komutu ver.
```

```sh
forge script script/Deploy.s.sol --rpc-url $RPC_URL --account deployer --broadcast
for c in FairLend AdminOracle MockERC20; do forge verify-contract <adres> $c --chain 10143 \
  --verifier sourcify --verifier-url https://sourcify-api-monad.blockvision.org; done
```

**13:15 handoff:** `web/src/deployments.json` + `web/src/abi/*.json` commit + push → Naol'a haber.
Kesme: 13:15'te testnet'te değilse doğrulamayı sona bırak.
