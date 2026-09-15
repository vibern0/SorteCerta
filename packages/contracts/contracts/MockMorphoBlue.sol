// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IMorphoBlue} from "./MorphoYieldAdapter.sol";

contract MockMorphoBlue is IMorphoBlue {
    using SafeERC20 for IERC20;

    mapping(bytes32 id => MarketParams params) private _params;
    mapping(bytes32 id => Market marketState) private _markets;
    mapping(bytes32 id => mapping(address user => Position userPosition)) private _positions;

    function createMarket(MarketParams calldata params) external returns (bytes32 marketId) {
        marketId = id(params);
        _params[marketId] = params;
        _markets[marketId].lastUpdate = uint128(block.timestamp);
    }

    function accrueYield(MarketParams calldata params, uint256 assets) external {
        bytes32 marketId = id(params);
        IERC20(params.loanToken).safeTransferFrom(msg.sender, address(this), assets);
        _markets[marketId].totalSupplyAssets += uint128(assets);
    }

    function supply(
        MarketParams calldata params,
        uint256 assets,
        uint256 shares,
        address onBehalf,
        bytes calldata
    ) external returns (uint256 suppliedAssets, uint256 suppliedShares) {
        require(shares == 0, "shares unsupported");

        bytes32 marketId = id(params);
        Market storage m = _markets[marketId];
        suppliedAssets = assets;
        suppliedShares = m.totalSupplyShares == 0
            ? assets
            : (assets * uint256(m.totalSupplyShares)) / uint256(m.totalSupplyAssets);

        IERC20(params.loanToken).safeTransferFrom(msg.sender, address(this), assets);
        m.totalSupplyAssets += uint128(suppliedAssets);
        m.totalSupplyShares += uint128(suppliedShares);
        _positions[marketId][onBehalf].supplyShares += suppliedShares;
    }

    function withdraw(
        MarketParams calldata params,
        uint256 assets,
        uint256 shares,
        address onBehalf,
        address receiver
    ) external returns (uint256 withdrawnAssets, uint256 withdrawnShares) {
        require(shares == 0, "shares unsupported");

        bytes32 marketId = id(params);
        Market storage m = _markets[marketId];
        Position storage p = _positions[marketId][onBehalf];

        withdrawnAssets = assets;
        withdrawnShares = _toSharesUp(assets, m.totalSupplyAssets, m.totalSupplyShares);
        require(withdrawnShares <= p.supplyShares, "insufficient shares");

        p.supplyShares -= withdrawnShares;
        m.totalSupplyAssets -= uint128(withdrawnAssets);
        m.totalSupplyShares -= uint128(withdrawnShares);
        IERC20(params.loanToken).safeTransfer(receiver, withdrawnAssets);
    }

    function idToMarketParams(bytes32 marketId) external view returns (MarketParams memory) {
        return _params[marketId];
    }

    function market(bytes32 marketId) external view returns (Market memory) {
        return _markets[marketId];
    }

    function position(bytes32 marketId, address user) external view returns (Position memory) {
        return _positions[marketId][user];
    }

    function id(MarketParams memory params) public pure returns (bytes32) {
        return keccak256(abi.encode(params));
    }

    function _toSharesUp(uint256 assets, uint256 totalAssets, uint256 totalShares) private pure returns (uint256) {
        if (assets == 0 || totalShares == 0) return 0;
        return (assets * totalShares + totalAssets - 1) / totalAssets;
    }
}
