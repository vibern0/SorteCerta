// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, ebool, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";
import {IERC7984ERC20Wrapper} from "@openzeppelin/confidential-contracts/interfaces/IERC7984ERC20Wrapper.sol";
import {IERC7984Receiver} from "@openzeppelin/confidential-contracts/interfaces/IERC7984Receiver.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

interface IERC7984ERC20WrapperInternalAmount is IERC7984ERC20Wrapper {
    function unwrap(address from, address to, euint64 amount) external returns (bytes32);
}

/// @notice Phase 2 confidential principal accounting and no-loss withdrawal.
contract ConfidentialPrizePool is ZamaEthereumConfig, IERC7984Receiver {
    uint256 public constant MAX_PARTICIPANTS = 32;
    uint64 public constant MAX_DRAW_TICKETS = 1_048_576;
    bytes4 public constant PRIZE_FUNDING_DATA = bytes4(keccak256("SorteCerta.prize"));

    IERC7984 public immutable token;
    address public immutable owner;

    mapping(address account => euint64 principal) private _principal;
    mapping(address account => bool known) private _isParticipant;
    mapping(address account => euint64 winnings) private _winnings;
    address[] private _participants;
    euint64 private _totalPrincipal;
    euint64 private _prizeReserve;
    uint256 private _drawId;

    event ConfidentialDeposit(address indexed account, euint64 indexed amount);
    event PrizeFunded(address indexed account, euint64 indexed amount);
    event DrawClosed(uint256 indexed drawId, euint64 indexed randomTicket, euint64 indexed prizeAmount);
    event PrizeClaimed(address indexed account, euint64 indexed amount);
    event ConfidentialWithdrawal(address indexed account, euint64 indexed amount);
    event ConfidentialWithdrawalToUsdc(address indexed account, address indexed to, euint64 indexed amount, bytes32 unwrapRequestId);

    error OnlyConfidentialToken();
    error OnlyOwner();
    error TooManyParticipants();

    constructor(IERC7984 token_) {
        token = token_;
        owner = msg.sender;
    }

    function onConfidentialTransferReceived(
        address,
        address from,
        euint64 amount,
        bytes calldata data
    ) external returns (ebool) {
        if (msg.sender != address(token)) revert OnlyConfidentialToken();

        if (bytes4(data) == PRIZE_FUNDING_DATA) {
            _prizeReserve = FHE.add(_prizeReserve, amount);
            FHE.allowThis(_prizeReserve);

            ebool funded = FHE.asEbool(true);
            FHE.allowTransient(funded, msg.sender);

            emit PrizeFunded(from, amount);
            return funded;
        }

        _registerParticipant(from);

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

    function closeDraw() external returns (euint64) {
        if (msg.sender != owner) revert OnlyOwner();

        euint64 randomTicket = FHE.randEuint64(MAX_DRAW_TICKETS);
        euint64 cumulative = FHE.asEuint64(0);
        ebool alreadyAwarded = FHE.asEbool(false);
        euint64 prize = _prizeReserve;
        _prizeReserve = FHE.asEuint64(0);

        for (uint256 i = 0; i < _participants.length; i++) {
            address participant = _participants[i];
            euint64 previous = cumulative;
            cumulative = FHE.add(cumulative, _principal[participant]);

            ebool atOrAfterStart = FHE.ge(randomTicket, previous);
            ebool beforeEnd = FHE.lt(randomTicket, cumulative);
            ebool selected = FHE.and(FHE.and(atOrAfterStart, beforeEnd), FHE.not(alreadyAwarded));
            euint64 award = FHE.select(selected, prize, FHE.asEuint64(0));

            _winnings[participant] = FHE.add(_winnings[participant], award);
            FHE.allowThis(_winnings[participant]);
            FHE.allow(_winnings[participant], participant);

            alreadyAwarded = FHE.or(alreadyAwarded, selected);
        }

        euint64 carry = FHE.select(alreadyAwarded, FHE.asEuint64(0), prize);
        _prizeReserve = FHE.add(_prizeReserve, carry);
        FHE.allowThis(_prizeReserve);
        FHE.allowThis(randomTicket);

        _drawId++;
        emit DrawClosed(_drawId, randomTicket, prize);
        return randomTicket;
    }

    function claimPrize() external returns (euint64) {
        euint64 amount = _winnings[msg.sender];
        _winnings[msg.sender] = FHE.asEuint64(0);

        FHE.allowThis(_winnings[msg.sender]);
        FHE.allow(_winnings[msg.sender], msg.sender);
        FHE.allowThis(amount);
        FHE.allow(amount, address(token));

        token.confidentialTransfer(msg.sender, amount);

        emit PrizeClaimed(msg.sender, amount);
        return amount;
    }

    function withdraw(externalEuint64 encryptedAmount, bytes calldata inputProof) external returns (euint64) {
        euint64 requested = FHE.fromExternal(encryptedAmount, inputProof);
        euint64 withdrawn = _withdrawPrincipal(msg.sender, requested);

        FHE.allow(withdrawn, address(token));

        token.confidentialTransfer(msg.sender, withdrawn);

        emit ConfidentialWithdrawal(msg.sender, withdrawn);
        return withdrawn;
    }

    function withdrawToUsdc(
        externalEuint64 encryptedAmount,
        bytes calldata inputProof,
        address to
    ) external returns (bytes32) {
        euint64 requested = FHE.fromExternal(encryptedAmount, inputProof);
        euint64 withdrawn = _withdrawPrincipal(msg.sender, requested);

        FHE.allow(withdrawn, address(token));

        bytes32 unwrapRequestId = IERC7984ERC20WrapperInternalAmount(address(token)).unwrap(address(this), to, withdrawn);

        emit ConfidentialWithdrawalToUsdc(msg.sender, to, withdrawn, unwrapRequestId);
        return unwrapRequestId;
    }

    function _withdrawPrincipal(address account, euint64 requested) internal returns (euint64) {
        euint64 available = _principal[account];
        euint64 withdrawn = FHE.min(requested, available);

        _principal[account] = FHE.sub(available, withdrawn);
        _totalPrincipal = FHE.sub(_totalPrincipal, withdrawn);

        FHE.allowThis(_principal[account]);
        FHE.allow(_principal[account], account);
        FHE.allowThis(_totalPrincipal);
        FHE.allowThis(withdrawn);

        return withdrawn;
    }

    function _registerParticipant(address account) internal {
        if (_isParticipant[account]) return;
        if (_participants.length >= MAX_PARTICIPANTS) revert TooManyParticipants();

        _isParticipant[account] = true;
        _participants.push(account);
    }

    function encryptedPrincipalOf(address account) external view returns (euint64) {
        return _principal[account];
    }

    function encryptedWinningsOf(address account) external view returns (euint64) {
        return _winnings[account];
    }

    function encryptedTotalPrincipal() external view returns (euint64) {
        return _totalPrincipal;
    }

    function encryptedPrizeReserve() external view returns (euint64) {
        return _prizeReserve;
    }

    function participantCount() external view returns (uint256) {
        return _participants.length;
    }

    function participantAt(uint256 index) external view returns (address) {
        return _participants[index];
    }

    function drawId() external view returns (uint256) {
        return _drawId;
    }
}
