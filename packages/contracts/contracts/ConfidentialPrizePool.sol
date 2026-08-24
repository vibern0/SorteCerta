// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, ebool, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";
import {IERC7984Receiver} from "@openzeppelin/confidential-contracts/interfaces/IERC7984Receiver.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @notice Phase 2 confidential principal accounting and no-loss withdrawal.
contract ConfidentialPrizePool is ZamaEthereumConfig, IERC7984Receiver {
    IERC7984 public immutable token;

    mapping(address account => euint64 principal) private _principal;
    euint64 private _totalPrincipal;

    event ConfidentialDeposit(address indexed account, euint64 indexed amount);
    event ConfidentialWithdrawal(address indexed account, euint64 indexed amount);

    error OnlyConfidentialToken();

    constructor(IERC7984 token_) {
        token = token_;
    }

    function onConfidentialTransferReceived(
        address,
        address from,
        euint64 amount,
        bytes calldata
    ) external returns (ebool) {
        if (msg.sender != address(token)) revert OnlyConfidentialToken();

        _principal[from] = FHE.add(_principal[from], amount);
        _totalPrincipal = FHE.add(_totalPrincipal, amount);

        FHE.allowThis(_principal[from]);
        FHE.allow(_principal[from], from);
        FHE.allowThis(_totalPrincipal);

        ebool success = FHE.asEbool(true);
        FHE.allowTransient(success, msg.sender);

        emit ConfidentialDeposit(from, amount);
        return success;
    }

    function withdraw(externalEuint64 encryptedAmount, bytes calldata inputProof) external returns (euint64) {
        euint64 requested = FHE.fromExternal(encryptedAmount, inputProof);
        euint64 available = _principal[msg.sender];
        euint64 withdrawn = FHE.min(requested, available);

        _principal[msg.sender] = FHE.sub(available, withdrawn);
        _totalPrincipal = FHE.sub(_totalPrincipal, withdrawn);

        FHE.allowThis(_principal[msg.sender]);
        FHE.allow(_principal[msg.sender], msg.sender);
        FHE.allowThis(_totalPrincipal);
        FHE.allowThis(withdrawn);
        FHE.allow(withdrawn, address(token));

        token.confidentialTransfer(msg.sender, withdrawn);

        emit ConfidentialWithdrawal(msg.sender, withdrawn);
        return withdrawn;
    }

    function encryptedPrincipalOf(address account) external view returns (euint64) {
        return _principal[account];
    }

    function encryptedTotalPrincipal() external view returns (euint64) {
        return _totalPrincipal;
    }
}
