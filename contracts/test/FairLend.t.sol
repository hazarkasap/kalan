// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockERC20} from "../src/MockERC20.sol";
import {AdminOracle} from "../src/AdminOracle.sol";
import {FairLend} from "../src/FairLend.sol";

contract FairLendTest is Test {
    MockERC20 usdc;
    MockERC20 weth;
    AdminOracle oracle;
    FairLend lend;
    address borrowerFixed = makeAddr("borrowerFixed");
    address borrowerFair = makeAddr("borrowerFair");
    address bot = makeAddr("bot");
    address bot2 = makeAddr("bot2");

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC");
        weth = new MockERC20("Wrapped Ether", "WETH");
        oracle = new AdminOracle(3000e18);
        lend = new FairLend(oracle, usdc, weth, borrowerFixed, borrowerFair);
        oracle.setLender(address(lend));
        usdc.mint(address(lend), 1_000_000e18);
        lend.resetDemo();

        for (uint256 i; i < 2; i++) {
            address b = i == 0 ? bot : bot2;
            usdc.mint(b, 10_000e18);
            vm.prank(b);
            usdc.approve(address(lend), type(uint256).max);
        }
        vm.roll(100);
    }

    function _usd(uint256 wethAmount) internal view returns (uint256) {
        return wethAmount * oracle.price() / 1e18;
    }

    function test_FixedPays10Percent() public {
        oracle.setPrice(2300e18);
        assertTrue(lend.isLiquidatable(borrowerFixed));
        assertEq(lend.premiumNow(borrowerFixed), 1000);

        vm.prank(bot);
        lend.liquidate(borrowerFixed);

        // 2000 * 1.10 / 2300 = 0.95652 WETH to bot, 0.04348 WETH (~100 $) back to borrower
        assertApproxEqAbs(_usd(weth.balanceOf(bot)), 2200e18, 1e9);
        assertApproxEqAbs(_usd(weth.balanceOf(borrowerFixed)), 100e18, 1e9);
        assertEq(usdc.balanceOf(bot), 8_000e18);
        (uint256 c, uint256 d, uint8 m,) = lend.positions(borrowerFixed);
        assertEq(c + d + m, 0);
    }

    function test_FairPays150BpsAfter3Blocks() public {
        oracle.setPrice(2300e18);
        assertEq(lend.premiumNow(borrowerFair), 0);
        vm.expectRevert(FairLend.NotFlagged.selector);
        lend.liquidate(borrowerFair);

        lend.flag(borrowerFair);
        vm.roll(block.number + 3);
        assertEq(lend.premiumNow(borrowerFair), 150);

        vm.prank(bot);
        lend.liquidate(borrowerFair);

        // 2000 * 1.015 / 2300 = 0.88261 WETH to bot, 0.11739 WETH (~270 $) back to borrower
        assertApproxEqAbs(_usd(weth.balanceOf(bot)), 2030e18, 1e9);
        assertApproxEqAbs(_usd(weth.balanceOf(borrowerFair)), 270e18, 1e9);
    }

    function test_SecondLiquidateSameBlockReverts() public {
        oracle.setPrice(2300e18);
        vm.prank(bot);
        lend.liquidate(borrowerFixed);

        vm.prank(bot2);
        vm.expectRevert(FairLend.Healthy.selector); // position deleted: 0 debt is never liquidatable
        lend.liquidate(borrowerFixed);
    }

    function test_FlagRevertsWhenHealthy() public {
        vm.expectRevert(FairLend.Healthy.selector);
        lend.flag(borrowerFair);
    }

    function test_PremiumCapsAt1000() public {
        oracle.setPrice(2300e18);
        lend.flag(borrowerFair);
        vm.roll(block.number + 50);
        assertEq(lend.premiumNow(borrowerFair), 1000);
    }

    function test_OnlyAdminCanSetPriceOrReset() public {
        vm.startPrank(bot);
        vm.expectRevert(AdminOracle.NotAdmin.selector);
        oracle.setPrice(1e18);
        vm.expectRevert(FairLend.NotAdmin.selector);
        lend.resetDemo();
        vm.stopPrank();
    }
}
