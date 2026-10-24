# Kalan web

Vite + React + TypeScript + viem. Demo UI for FairLend on Monad testnet.

```sh
cp .env.example .env
npm install
npm run dev
```

Always reads the live deployment in `src/deployments.json` (no mock). The RPC must allow
`debug_traceTransaction` for revert reasons in the bot log; without it losers show "reverted".
Never put a private key here.

Admin UI (connected wallet = `admin()` only): Crash price (live) → `setPrice(2300e18)`; Reset demo → `resetDemo()`. Never `setPrice(3000e18)` from the browser.
