# N0 — Setup (12:30–12:45) · Cursor

**Goal:** a running Vite + React + TS app in `web/` with a mock data layer that matches the frozen ABI,
so the UI never waits for the real contracts.

## Prompt

```text
Create a Vite + React + TypeScript app in web/ (npm create vite@latest web -- --template react-ts).
Install viem, wagmi, @tanstack/react-query.

Create these files:

1) web/src/chain.ts
   - Define monadTestnet with viem defineChain: id 10143, name "Monad Testnet",
     nativeCurrency MON (18 decimals), rpc http from import.meta.env.VITE_RPC_URL
     (fallback https://rpc-testnet.monadinfra.com), ws from import.meta.env.VITE_WS_URL.
   - Explorer base: https://testnet.monadvision.com  (helpers txUrl(hash), addressUrl(addr)).

2) web/src/abi.ts — human-readable ABI via viem parseAbi, exactly:
   "function price() view returns (uint256)",
   "function setPrice(uint256 p)",
   "function admin() view returns (address)",
   "function positions(address user) view returns (uint256 collateral, uint256 debt, uint8 mode, uint256 startBlock)",
   "function premiumNow(address user) view returns (uint256)",
   "function isLiquidatable(address user) view returns (bool)",
   "function resetDemo()",
   "event Flagged(address indexed user, uint256 startBlock)",
   "event Liquidated(address indexed user, address indexed liquidator, uint256 premiumBps, uint256 toLiquidator, uint256 toBorrower, uint256 blockNumber)",
   "event PriceSet(uint256 price)"
   Units: tokens have 18 decimals, price is 1e18-scaled USD (3000 USD = 3000e18). mode: 0 NONE, 1 FIXED, 2 FAIR.

3) web/src/deployments.mock.json:
   { "chainId": 10143, "fairLend": "0x0000000000000000000000000000000000000001",
     "oracle": "0x0000000000000000000000000000000000000002", "usdc": "0x...03", "weth": "0x...04",
     "borrowerFixed": "0x...05", "borrowerFair": "0x...06", "bots": ["0x...0A","0x...0B","0x...0C"] }
   (use valid 40-hex-char addresses).

4) web/src/data.ts — a single data interface used by the whole UI:
   type Run = { price: number; fixed: Side; fair: Side; }
   type Side = { collateralEth: number; debtUsd: number; premiumBps: number; flaggedAtBlock?: number;
                 liquidated?: { liquidator: string; botName: "A"|"B"|"C"; premiumBps: number;
                 toLiquidatorEth: number; toBorrowerEth: number; blockNumber: number; txHash: string } }
   Export useRun(): Run. For now implement it with a MOCK that simulates the demo:
   price 3000 -> after "crash" 2300; FIXED liquidates immediately at 1000 bps (borrower keeps ~$100);
   FAIR premium rises 50 bps per ~400ms block and liquidates at 150 bps (borrower keeps ~$270).
   Export a function triggerMockCrash(). Add a flag USE_MOCK = !import.meta.env.VITE_FAIRLEND.

5) web/.env.example with VITE_RPC_URL, VITE_WS_URL (no private keys ever).

Run npm run dev and confirm it builds. List the files you created.
```

## Done when

- [ ] `cd web && npm run dev` works
- [ ] `useRun()` returns mock data; `triggerMockCrash()` animates premium
- [ ] Commit: `web: vite scaffold + mock data layer`
