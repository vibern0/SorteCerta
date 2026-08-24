// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockUSDC — testnet-only USDC stand-in.
/// @notice Anyone can mint to themselves via the faucet. Production replaces this
///         with the real USDC token (or a bridged version).
contract MockUSDC is ERC20, Ownable {
    constructor() ERC20("USD Coin", "USDC") Ownable(msg.sender) {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Anyone can mint test USDC to themselves for testing.
    function faucet(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
