// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {euint64} from "@fhevm/solidity/lib/FHE.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC7984ERC20Wrapper} from "@openzeppelin/confidential-contracts/interfaces/IERC7984ERC20Wrapper.sol";

interface IConfidentialPrizePoolFunding {
    function PRIZE_FUNDING_DATA() external view returns (bytes4);
}

interface IMorphoBlue {
    struct MarketParams {
        address loanToken;
        address collateralToken;
        address oracle;
        address irm;
        uint256 lltv;
    }

    struct Market {
        uint128 totalSupplyAssets;
        uint128 totalSupplyShares;
        uint128 totalBorrowAssets;
        uint128 totalBorrowShares;
        uint128 lastUpdate;
        uint128 fee;
    }

    struct Position {
        uint256 supplyShares;
        uint128 borrowShares;
        uint128 collateral;
    }

    function supply(
        MarketParams calldata marketParams,
        uint256 assets,
        uint256 shares,
        address onBehalf,
        bytes calldata data
    ) external returns (uint256 suppliedAssets, uint256 suppliedShares);

    function withdraw(
        MarketParams calldata marketParams,
        uint256 assets,
        uint256 shares,
        address onBehalf,
        address receiver
    ) external returns (uint256 withdrawnAssets, uint256 withdrawnShares);

    function idToMarketParams(bytes32 id) external view returns (MarketParams memory);
    function market(bytes32 id) external view returns (Market memory);
    function position(bytes32 id, address user) external view returns (Position memory);
}

interface IConfidentialTokenTransfer {
    function confidentialTransfer(address to, euint64 amount) external returns (euint64 transferred);
}

/// @notice Morpho Blue position owned by the confidential prize pool.
contract MorphoYieldAdapter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    IERC7984ERC20Wrapper public immutable confidentialUsdc;
    IConfidentialPrizePoolFunding public immutable prizePool;
    IMorphoBlue public immutable morpho;

    IMorphoBlue.MarketParams private _marketParams;
    bytes32 public immutable marketId;
    uint256 public suppliedPrincipal;

    event PoolPrincipalSupplied(uint256 assets, uint256 shares);
    event PoolPrincipalRestored(uint256 assets, uint256 shares);
    event YieldHarvested(uint256 assets, uint256 shares);
    event PrizeFundedFromYield(uint256 assets);

    error InvalidLoanToken(address expected, address actual);
    error InvalidReceiver();
    error NoAccruedYield();
    error AmountTooLargeForConfidentialToken(uint256 amount);
    error PrincipalWithdrawalExceedsSupply(uint256 requested, uint256 suppliedPrincipal);
    error UnknownMorphoMarket(bytes32 marketId);
    error OnlyPrizePool();

    constructor(
        IERC20 usdc_,
        IERC7984ERC20Wrapper confidentialUsdc_,
        IConfidentialPrizePoolFunding prizePool_,
        IMorphoBlue morpho_,
        IMorphoBlue.MarketParams memory marketParams_
    ) Ownable(msg.sender) {
        if (marketParams_.loanToken != address(usdc_)) {
            revert InvalidLoanToken(address(usdc_), marketParams_.loanToken);
        }

        usdc = usdc_;
        confidentialUsdc = confidentialUsdc_;
        prizePool = prizePool_;
        morpho = morpho_;
        _marketParams = marketParams_;
        marketId = id(marketParams_);

        IMorphoBlue.MarketParams memory registered = morpho_.idToMarketParams(marketId);
        if (registered.loanToken != marketParams_.loanToken) revert UnknownMorphoMarket(marketId);
    }

    modifier onlyPrizePool() {
        if (msg.sender != address(prizePool)) revert OnlyPrizePool();
        _;
    }

    function supplyPoolPrincipal(uint256 assets) external onlyPrizePool nonReentrant returns (uint256 shares) {
        usdc.forceApprove(address(morpho), assets);

        (uint256 assetsSupplied, uint256 sharesSupplied) = morpho.supply(_marketParams, assets, 0, address(this), "");
        suppliedPrincipal += assetsSupplied;

        emit PoolPrincipalSupplied(assetsSupplied, sharesSupplied);
        return sharesSupplied;
    }

    function restorePrincipalToPool(uint256 assets) external onlyPrizePool nonReentrant returns (uint256 restoredAssets) {
        if (assets > suppliedPrincipal) revert PrincipalWithdrawalExceedsSupply(assets, suppliedPrincipal);

        (uint256 withdrawnAssets, uint256 withdrawnShares) = morpho.withdraw(
            _marketParams,
            assets,
            0,
            address(this),
            address(this)
        );
        suppliedPrincipal -= withdrawnAssets;

        _wrapAndSendToPool(withdrawnAssets, false);

        emit PoolPrincipalRestored(withdrawnAssets, withdrawnShares);
        return withdrawnAssets;
    }

    function harvestYieldToPrizePool(uint256 maxAssets) external onlyPrizePool nonReentrant returns (uint256 harvestedAssets) {
        uint256 accrued = accruedYieldAssets();
        if (accrued == 0) revert NoAccruedYield();

        harvestedAssets = maxAssets == 0 || maxAssets > accrued ? accrued : maxAssets;
        if (harvestedAssets > type(uint64).max) revert AmountTooLargeForConfidentialToken(harvestedAssets);

        (uint256 withdrawnAssets, uint256 withdrawnShares) = morpho.withdraw(
            _marketParams,
            harvestedAssets,
            0,
            address(this),
            address(this)
        );

        _wrapAndSendToPool(withdrawnAssets, true);

        emit YieldHarvested(withdrawnAssets, withdrawnShares);
        emit PrizeFundedFromYield(withdrawnAssets);
        return withdrawnAssets;
    }

    function accruedYieldAssets() public view returns (uint256) {
        uint256 supplied = suppliedAssets();
        return supplied > suppliedPrincipal ? supplied - suppliedPrincipal : 0;
    }

    function suppliedAssets() public view returns (uint256) {
        IMorphoBlue.Market memory m = morpho.market(marketId);
        uint256 shares = morpho.position(marketId, address(this)).supplyShares;
        if (shares == 0 || m.totalSupplyShares == 0) return 0;
        return (shares * uint256(m.totalSupplyAssets)) / uint256(m.totalSupplyShares);
    }

    function marketParams() external view returns (IMorphoBlue.MarketParams memory) {
        return _marketParams;
    }

    function id(IMorphoBlue.MarketParams memory marketParams_) public pure returns (bytes32) {
        return keccak256(abi.encode(marketParams_));
    }

    function _wrapAndSendToPool(uint256 assets, bool asPrizeFunding) private {
        if (assets > type(uint64).max) revert AmountTooLargeForConfidentialToken(assets);

        usdc.forceApprove(address(confidentialUsdc), assets);
        euint64 wrapped = confidentialUsdc.wrap(address(this), assets);

        if (asPrizeFunding) {
            confidentialUsdc.confidentialTransferAndCall(
                address(prizePool),
                wrapped,
                abi.encodePacked(prizePool.PRIZE_FUNDING_DATA(), abi.encode(uint64(assets)))
            );
        } else {
            IConfidentialTokenTransfer(address(confidentialUsdc)).confidentialTransfer(address(prizePool), wrapped);
        }
    }
}
