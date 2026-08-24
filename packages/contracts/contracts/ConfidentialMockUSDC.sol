// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";
import {ERC7984ERC20Wrapper} from "@openzeppelin/confidential-contracts/token/ERC7984/extensions/ERC7984ERC20Wrapper.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @notice ERC-7984 wrapper for the faucet-backed MockUSDC test token.
contract ConfidentialMockUSDC is ZamaEthereumConfig, ERC7984ERC20Wrapper {
    constructor(IERC20 underlying)
        ERC7984("Confidential Mock USDC", "cMockUSDC", "https://sortecerta.local/cmockusdc")
        ERC7984ERC20Wrapper(underlying)
    {}
}
