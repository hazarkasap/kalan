// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice ETH/USD price, 1e18 scaled. Only the admin (or the lender it authorizes) can set it.
/// @dev The admin stays the human wallet so the UI can call setPrice(2300e18);
///      the lender (FairLend) is authorized separately so resetDemo() can pull the price back to 3000e18.
contract AdminOracle {
    address public immutable admin;
    address public lender;
    uint256 public price;

    event PriceSet(uint256 price);

    error NotAdmin();

    constructor(uint256 initialPrice) {
        admin = msg.sender;
        price = initialPrice;
        emit PriceSet(initialPrice);
    }

    modifier onlyAdmin() {
        if (msg.sender != admin && msg.sender != lender) revert NotAdmin();
        _;
    }

    function setLender(address lender_) external {
        if (msg.sender != admin) revert NotAdmin();
        lender = lender_;
    }

    function setPrice(uint256 p) external onlyAdmin {
        price = p;
        emit PriceSet(p);
    }
}
