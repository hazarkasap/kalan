# Kalan web

Vite + React + TypeScript + viem. Demo UI for FairLend on Monad testnet.

```sh
cp .env.example .env
npm install
npm run dev
```

Set `VITE_FAIRLEND=1` to read the live deployment (`src/deployments.json`). Never put a private key here.

Admin UI (connected wallet = `admin()` only): Market crash → `setPrice(2300e18)`; Reset demo → `resetDemo()`. Never `setPrice(3000e18)` from the browser.
