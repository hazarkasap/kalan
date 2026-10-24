// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MockERC20} from "./MockERC20.sol";
import {AdminOracle} from "./AdminOracle.sol";

/// @notice Single-asset lending (WETH collateral, USDC debt) with two liquidation modes:
///         FIXED pays a flat 10% premium, FAIR runs a premium auction rising 0.5% per block.
contract FairLend {
    uint8 public constant NONE = 0;
    uint8 public constant FIXED = 1;
    uint8 public constant FAIR = 2;
    uint256 public constant THRESHOLD_PCT = 85;
    uint256 public constant STEP_BPS = 50;
    uint256 public constant MAX_BPS = 1000;

    struct Position {
        uint256 collateral;
        uint256 debt;
        uint8 mode;
        uint256 startBlock;
    }

    address public immutable admin;
    AdminOracle public immutable oracle;
    MockERC20 public immutable usdc;
    MockERC20 public immutable weth;
    address public immutable borrowerFixed;
    address public immutable borrowerFair;

    mapping(address => Position) public positions;

    event Flagged(address indexed user, uint256 startBlock);
    event Liquidated(
        address indexed user,
        address indexed liquidator,
        uint256 premiumBps,
        uint256 toLiquidator,
        uint256 toBorrower,
        uint256 blockNumber
    );

    error NotAdmin();
    error BadMode();
    error Healthy();
    error Unhealthy();
    error NotFair();
    error AlreadyFlagged();
    error NotFlagged();

    constructor(AdminOracle oracle_, MockERC20 usdc_, MockERC20 weth_, address borrowerFixed_, address borrowerFair_) {
        admin = msg.sender;
        oracle = oracle_;
        usdc = usdc_;
        weth = weth_;
        borrowerFixed = borrowerFixed_;
        borrowerFair = borrowerFair_;
    }

    /// @notice Deposit WETH. The mode is fixed on the first deposit.
    function deposit(uint256 amount, uint8 mode) external {
        Position storage p = positions[msg.sender];
        if (p.mode == NONE) {
            if (mode != FIXED && mode != FAIR) revert BadMode();
            p.mode = mode;
        }
        p.collateral += amount;
        weth.transferFrom(msg.sender, address(this), amount);
    }

    function borrow(uint256 amount) external {
        Position storage p = positions[msg.sender];
        p.debt += amount;
        if (isLiquidatable(msg.sender)) revert Unhealthy();
        usdc.transfer(msg.sender, amount);
    }

    function isLiquidatable(address user) public view returns (bool) {
        Position storage p = positions[user];
        return p.collateral * oracle.price() / 1e18 * THRESHOLD_PCT / 100 < p.debt;
    }

    /// @notice Starts the FAIR premium auction for an unhealthy position.
    function flag(address user) external {
        Position storage p = positions[user];
        if (p.mode != FAIR) revert NotFair();
        if (!isLiquidatable(user)) revert Healthy();
        if (p.startBlock != 0) revert AlreadyFlagged();
        p.startBlock = block.number;
        emit Flagged(user, block.number);
    }

    function premiumNow(address user) public view returns (uint256) {
        Position storage p = positions[user];
        if (p.mode == FIXED) return MAX_BPS;
        if (p.mode != FAIR || p.startBlock == 0) return 0;
        uint256 bps = (block.number - p.startBlock) * STEP_BPS;
        return bps < MAX_BPS ? bps : MAX_BPS;
    }

    /// @notice Repay the whole debt in USDC and take debt*(1+premium)/price of WETH; the rest goes to the borrower.
    function liquidate(address user) external {
        Position memory p = positions[user];
        if (!isLiquidatable(user)) revert Healthy();
        if (p.mode == FAIR && p.startBlock == 0) revert NotFlagged();

        uint256 prem = premiumNow(user);
        uint256 toLiq = p.debt * (10000 + prem) / 10000 * 1e18 / oracle.price();
        if (toLiq > p.collateral) toLiq = p.collateral;
        uint256 toBorrower = p.collateral - toLiq;

        delete positions[user];
        emit Liquidated(user, msg.sender, prem, toLiq, toBorrower, block.number);

        usdc.transferFrom(msg.sender, address(this), p.debt);
        weth.transfer(msg.sender, toLiq);
        if (toBorrower > 0) weth.transfer(user, toBorrower);
    }

    /// @notice Pulls the price back to 3000 and reopens both demo positions (1 WETH, 2000 USDC debt).
    ///         Borrower actions are done on their behalf, so borrowers need no MON.
    function resetDemo() external {
        if (msg.sender != admin) revert NotAdmin();
        oracle.setPrice(3000e18);
        _open(borrowerFixed, FIXED);
        _open(borrowerFair, FAIR);
    }

    function _open(address user, uint8 mode) internal {
        positions[user] = Position({collateral: 1e18, debt: 2000e18, mode: mode, startBlock: 0});
        weth.mint(address(this), 1e18);
        usdc.transfer(user, 2000e18);
    }
}
