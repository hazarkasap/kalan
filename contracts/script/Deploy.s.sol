// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {MockERC20} from "../src/MockERC20.sol";
import {AdminOracle} from "../src/AdminOracle.sol";
import {FairLend} from "../src/FairLend.sol";

/// @notice Deploys everything, opens both demo positions and writes ../web/src/deployments.json.
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("ADMIN_PK");
        address borrowerFixed = vm.envAddress("BORROWER_FIXED_ADDR");
        address borrowerFair = vm.envAddress("BORROWER_FAIR_ADDR");
        address[3] memory bots = [vm.envAddress("BOT_A_ADDR"), vm.envAddress("BOT_B_ADDR"), vm.envAddress("BOT_C_ADDR")];

        vm.startBroadcast(pk);
        MockERC20 usdc = new MockERC20("USD Coin", "USDC");
        MockERC20 weth = new MockERC20("Wrapped Ether", "WETH");
        AdminOracle oracle = new AdminOracle(3000e18);
        FairLend lend = new FairLend(oracle, usdc, weth, borrowerFixed, borrowerFair);
        oracle.setLender(address(lend));
        usdc.mint(address(lend), 1_000_000e18);
        for (uint256 i; i < 3; i++) usdc.mint(bots[i], 10_000e18);
        lend.resetDemo();
        vm.stopBroadcast();

        string memory o = "d";
        vm.serializeUint(o, "chainId", block.chainid);
        vm.serializeAddress(o, "fairLend", address(lend));
        vm.serializeAddress(o, "oracle", address(oracle));
        vm.serializeAddress(o, "usdc", address(usdc));
        vm.serializeAddress(o, "weth", address(weth));
        vm.serializeAddress(o, "borrowerFixed", borrowerFixed);
        vm.serializeAddress(o, "borrowerFair", borrowerFair);
        address[] memory b = new address[](3);
        for (uint256 i; i < 3; i++) b[i] = bots[i];
        string memory json = vm.serializeAddress(o, "bots", b);
        vm.writeJson(json, "../web/src/deployments.json");
    }
}
