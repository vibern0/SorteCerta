// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";

/// @title Vault — ERC4626 share-accounting wrapper around USDC.
/// @notice Users deposit USDC, receive vUSDC shares 1:1. Shares double as
///         "tickets" for the current PrizePool draw (ticket count = share balance).
///         Principal is always withdrawable — this is the no-loss property.
///
///         For the MVP on Sepolia, no real yield source is plugged in. Prizes
///         are funded by anyone calling PrizePool.fundPrizePool().
contract Vault is ERC4626 {
    constructor(IERC20 asset_) ERC20("Vault USDC Shares", "vUSDC") ERC4626(asset_) {}
}
