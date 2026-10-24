import { parseAbi } from 'viem'

/** Combined FairLend + AdminOracle surface from SPEC.md "ABI ayrıntısı". */
export const abi = parseAbi([
  'function price() view returns (uint256)',
  'function setPrice(uint256 p)',
  'function admin() view returns (address)',
  'function positions(address user) view returns (uint256 collateral, uint256 debt, uint8 mode, uint256 startBlock)',
  'function premiumNow(address user) view returns (uint256)',
  'function isLiquidatable(address user) view returns (bool)',
  'function resetDemo()',
  'event Flagged(address indexed user, uint256 startBlock)',
  'event Liquidated(address indexed user, address indexed liquidator, uint256 premiumBps, uint256 toLiquidator, uint256 toBorrower, uint256 blockNumber)',
  'event PriceSet(uint256 price)',
])

/** Tokens: 18 decimals. Price is 1e18-scaled USD (3000 USD = 3000e18). mode: 0 NONE, 1 FIXED, 2 FAIR. */
export const MODE = { NONE: 0, FIXED: 1, FAIR: 2 } as const
