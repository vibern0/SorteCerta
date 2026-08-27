// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, ebool, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";
import {IERC7984ERC20Wrapper} from "@openzeppelin/confidential-contracts/interfaces/IERC7984ERC20Wrapper.sol";
import {IERC7984Receiver} from "@openzeppelin/confidential-contracts/interfaces/IERC7984Receiver.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

interface IERC7984ERC20WrapperInternalAmount is IERC7984ERC20Wrapper {
    /// @notice Starts an unwrap from confidential tokens back to the underlying token.
    function unwrap(address from, address to, euint64 amount) external returns (bytes32);
}

/// @notice Confidential principal accounting, public mocked prize funding, and no-loss withdrawal.
contract ConfidentialPrizePool is ZamaEthereumConfig, IERC7984Receiver {
    uint256 public constant MAX_PARTICIPANTS = 32;
    uint64 public constant MAX_DRAW_TICKETS = 1_048_576;
    bytes4 public constant PRIZE_FUNDING_DATA = bytes4(keccak256("SorteCerta.prize"));

    IERC7984 public immutable token;
    address public immutable owner;
    uint256 public immutable drawInterval;
    uint256 public nextDrawAt;

    mapping(address account => euint64 principal) private _principal;
    mapping(address account => bool known) private _isParticipant;
    mapping(address account => address delegate) private _decryptDelegate;
    mapping(address account => euint64 winnings) private _winnings;
    address[] private _participants;
    euint64 private _totalPrincipal;
    euint64 private _prizeReserve;
    uint64 public publicPrizeReserve;
    uint256 private _drawId;

    event ConfidentialDeposit(address indexed account, euint64 indexed amount);
    event PrizeFunded(address indexed account, euint64 indexed amount, uint64 publicAmount);
    event DrawStarted(uint256 indexed drawId, uint256 nextDrawAt);
    event DrawClosed(uint256 indexed drawId, euint64 indexed randomTicket, euint64 indexed prizeAmount);
    event PrizeClaimed(address indexed account, euint64 indexed amount);
    event ConfidentialWithdrawal(address indexed account, euint64 indexed amount);
    event ConfidentialWithdrawalToUsdc(address indexed account, address indexed to, euint64 indexed amount, bytes32 unwrapRequestId);
    event DecryptDelegateUpdated(address indexed account, address indexed delegate);

    error OnlyConfidentialToken();
    error DrawNotReady(uint256 nextDrawAt);
    error TooManyParticipants();
    error InvalidPrizeFundingData();

    /// @notice Creates a pool for one confidential token and starts the first draw.
    constructor(IERC7984 token_, uint256 drawInterval_) {
        token = token_;
        drawInterval = drawInterval_;
        nextDrawAt = block.timestamp + drawInterval_;
        owner = msg.sender;

        emit DrawStarted(_drawId + 1, nextDrawAt);
    }

    /// @notice Receives confidential deposits or sponsor prize funding from the token.
    function onConfidentialTransferReceived(
        address,
        address from,
        euint64 amount,
        bytes calldata data
    ) external returns (ebool) {
        if (msg.sender != address(token)) revert OnlyConfidentialToken();

        if (bytes4(data) == PRIZE_FUNDING_DATA) {
            uint64 publicAmount = _decodePrizeFundingAmount(data);
            _prizeReserve = FHE.add(_prizeReserve, amount);
            publicPrizeReserve += publicAmount;
            FHE.allowThis(_prizeReserve);

            ebool funded = FHE.asEbool(true);
            FHE.allowTransient(funded, msg.sender);

            emit PrizeFunded(from, amount, publicAmount);
            return funded;
        }

        address decryptDelegate = _decodeDecryptDelegate(data);
        if (decryptDelegate != address(0) && _decryptDelegate[from] != decryptDelegate) {
            _decryptDelegate[from] = decryptDelegate;
            emit DecryptDelegateUpdated(from, decryptDelegate);
        }

        _registerParticipant(from);

        _principal[from] = FHE.add(_principal[from], amount);
        _totalPrincipal = FHE.add(_totalPrincipal, amount);

        _allowAccount(_principal[from], from);
        FHE.allowThis(_totalPrincipal);

        ebool success = FHE.asEbool(true);
        FHE.allowTransient(success, msg.sender);

        emit ConfidentialDeposit(from, amount);
        return success;
    }

    /// @notice Closes the ready draw, privately credits any winner, and starts the next draw.
    function closeDraw() external returns (euint64) {
        if (block.timestamp < nextDrawAt) revert DrawNotReady(nextDrawAt);

        euint64 randomTicket = FHE.randEuint64(MAX_DRAW_TICKETS);
        euint64 cumulative = FHE.asEuint64(0);
        ebool alreadyAwarded = FHE.asEbool(false);
        euint64 prize = _prizeReserve;
        _prizeReserve = FHE.asEuint64(0);
        publicPrizeReserve = 0;

        for (uint256 i = 0; i < _participants.length; i++) {
            address participant = _participants[i];
            euint64 previous = cumulative;
            cumulative = FHE.add(cumulative, _principal[participant]);

            ebool atOrAfterStart = FHE.ge(randomTicket, previous);
            ebool beforeEnd = FHE.lt(randomTicket, cumulative);
            ebool selected = FHE.and(FHE.and(atOrAfterStart, beforeEnd), FHE.not(alreadyAwarded));
            euint64 award = FHE.select(selected, prize, FHE.asEuint64(0));

            _winnings[participant] = FHE.add(_winnings[participant], award);
            _allowAccount(_winnings[participant], participant);

            alreadyAwarded = FHE.or(alreadyAwarded, selected);
        }

        euint64 carry = FHE.select(alreadyAwarded, FHE.asEuint64(0), prize);
        _prizeReserve = FHE.add(_prizeReserve, carry);
        FHE.allowThis(_prizeReserve);
        FHE.allowThis(randomTicket);

        _drawId++;
        nextDrawAt = block.timestamp + drawInterval;
        emit DrawClosed(_drawId, randomTicket, prize);
        emit DrawStarted(_drawId + 1, nextDrawAt);
        return randomTicket;
    }

    /// @notice Moves the caller's prize winnings from the pool to their cUSDC balance.
    function claimPrize() external returns (euint64) {
        euint64 amount = _winnings[msg.sender];
        _winnings[msg.sender] = FHE.asEuint64(0);

        _allowAccount(_winnings[msg.sender], msg.sender);
        FHE.allowThis(amount);
        FHE.allow(amount, address(token));

        token.confidentialTransfer(msg.sender, amount);

        emit PrizeClaimed(msg.sender, amount);
        return amount;
    }

    /// @notice Lets another address decrypt the caller's pool balance and winnings.
    function setDecryptDelegate(address delegate) external {
        _decryptDelegate[msg.sender] = delegate;
        _allowAccount(_principal[msg.sender], msg.sender);
        _allowAccount(_winnings[msg.sender], msg.sender);

        emit DecryptDelegateUpdated(msg.sender, delegate);
    }

    /// @notice Withdraws up to the requested amount back to the caller as cUSDC.
    function withdraw(externalEuint64 encryptedAmount, bytes calldata inputProof) external returns (euint64) {
        euint64 requested = FHE.fromExternal(encryptedAmount, inputProof);
        euint64 withdrawn = _withdrawPrincipal(msg.sender, requested);

        FHE.allow(withdrawn, address(token));

        token.confidentialTransfer(msg.sender, withdrawn);

        emit ConfidentialWithdrawal(msg.sender, withdrawn);
        return withdrawn;
    }

    /// @notice Withdraws up to the requested amount and unwraps it to USDC for `to`.
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

    /// @notice Applies the no-loss withdrawal cap and updates encrypted principal.
    function _withdrawPrincipal(address account, euint64 requested) internal returns (euint64) {
        euint64 available = _principal[account];
        euint64 withdrawn = FHE.min(requested, available);

        _principal[account] = FHE.sub(available, withdrawn);
        _totalPrincipal = FHE.sub(_totalPrincipal, withdrawn);

        _allowAccount(_principal[account], account);
        FHE.allowThis(_totalPrincipal);
        FHE.allowThis(withdrawn);

        return withdrawn;
    }

    /// @notice Reads an optional decrypt delegate address from deposit callback data.
    function _decodeDecryptDelegate(bytes calldata data) internal pure returns (address) {
        if (data.length != 32) return address(0);
        return abi.decode(data, (address));
    }

    /// @notice Reads the public prize amount carried with sponsor funding data.
    function _decodePrizeFundingAmount(bytes calldata data) internal pure returns (uint64) {
        if (data.length != 36) revert InvalidPrizeFundingData();
        return abi.decode(data[4:], (uint64));
    }

    /// @notice Grants the pool, account, and optional delegate access to an encrypted value.
    function _allowAccount(euint64 value, address account) internal {
        FHE.allowThis(value);
        FHE.allow(value, account);

        address delegate = _decryptDelegate[account];
        if (delegate != address(0)) {
            FHE.allow(value, delegate);
        }
    }

    /// @notice Adds a depositor to the bounded participant list once.
    function _registerParticipant(address account) internal {
        if (_isParticipant[account]) return;
        if (_participants.length >= MAX_PARTICIPANTS) revert TooManyParticipants();

        _isParticipant[account] = true;
        _participants.push(account);
    }

    /// @notice Encrypted principal currently deposited by an account.
    function encryptedPrincipalOf(address account) external view returns (euint64) {
        return _principal[account];
    }

    /// @notice Encrypted unclaimed winnings for an account.
    function encryptedWinningsOf(address account) external view returns (euint64) {
        return _winnings[account];
    }

    /// @notice Address allowed to decrypt an account's pool values.
    function decryptDelegateOf(address account) external view returns (address) {
        return _decryptDelegate[account];
    }

    /// @notice Encrypted total principal held by the pool.
    function encryptedTotalPrincipal() external view returns (euint64) {
        return _totalPrincipal;
    }

    /// @notice Encrypted prize reserve available for future draws.
    function encryptedPrizeReserve() external view returns (euint64) {
        return _prizeReserve;
    }

    /// @notice Number of known participants in the bounded draw list.
    function participantCount() external view returns (uint256) {
        return _participants.length;
    }

    /// @notice Participant address at a draw-list index.
    function participantAt(uint256 index) external view returns (address) {
        return _participants[index];
    }

    /// @notice Number of draws already closed.
    function drawId() external view returns (uint256) {
        return _drawId;
    }
}
