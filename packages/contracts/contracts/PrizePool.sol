// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./Vault.sol";

/// @title PrizePool — periodic no-loss lottery.
/// @notice Holds the active draw, lets users deposit USDC into the vault and
///         receive proportional tickets, and at draw end picks a weighted-random
///         winner who claims the prize pool (funded externally — see
///         `fundPrizePool`). Principal is always withdrawable from the Vault.
///
///         MVP notes:
///         - Randomness uses the previous blockhash. Fine for testnet; swap to
///           Chainlink VRF before any real-value deployment.
///         - "Yield" is faked via `fundPrizePool` (sponsor / treasury / future
///           Aave yield source).
///         - Tickets = current vault share balance. A future v2 should snapshot
///           per-draw balances at draw start.
contract PrizePool is Ownable, ReentrancyGuard {
    using EnumerableSet for EnumerableSet.AddressSet;

    struct Draw {
        uint256 id;
        uint256 startTime;
        uint256 endTime;
        uint256 prizeAmount;
        address winner;
        bool fulfilled;
        uint256 randomWord;
    }

    Vault public immutable vault;
    IERC20 public immutable usdc;
    uint256 public drawInterval;

    uint256 public currentDrawId;
    mapping(uint256 => Draw) public draws;
    mapping(uint256 => EnumerableSet.AddressSet) private _participants;

    event DrawStarted(uint256 indexed drawId, uint256 startTime, uint256 endTime);
    event TicketsPurchased(uint256 indexed drawId, address indexed user, uint256 shares);
    event PrizeFunded(uint256 indexed drawId, address indexed funder, uint256 amount);
    event DrawClosed(uint256 indexed drawId, uint256 randomWord);
    event WinnerPicked(uint256 indexed drawId, address indexed winner, uint256 amount);

    error DrawNotEnded();
    error DrawAlreadyClosed();
    error ZeroAmount();
    error DrawEnded();

    /// @notice Creates the prize pool and starts the first draw.
    constructor(
        address _vault,
        address _usdc,
        uint256 _drawInterval
    ) Ownable(msg.sender) {
        vault = Vault(_vault);
        usdc = IERC20(_usdc);
        drawInterval = _drawInterval;
        _startNewDraw();
    }

    // ─── Views ──────────────────────────────────────────────────────────────

    /// @notice Returns the active draw.
    function currentDraw() external view returns (Draw memory) {
        return draws[currentDrawId];
    }

    /// @notice Returns all participant addresses for a draw.
    function getParticipants(uint256 drawId) external view returns (address[] memory) {
        return _participants[drawId].values();
    }

    /// @notice Ticket count for a user in the active draw. MVP: live share
    ///         balance. v2: snapshot at draw start.
    function getTickets(uint256 drawId, address user) public view returns (uint256) {
        if (drawId != currentDrawId) return 0;
        return vault.balanceOf(user);
    }

    // ─── User actions ───────────────────────────────────────────────────────

    /// @notice Deposit USDC into the vault and receive shares (= tickets).
    /// @param amount USDC amount in 6-decimal units (e.g. 10 USDC = 10_000_000).
    function depositAndBuyTickets(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (block.timestamp >= draws[currentDrawId].endTime) revert DrawEnded();

        // Pull USDC from user.
        usdc.transferFrom(msg.sender, address(this), amount);

        // Approve and deposit into the vault on behalf of this contract,
        // then transfer the resulting shares to the user.
        usdc.approve(address(vault), amount);
        uint256 shares = vault.deposit(amount, address(this));
        vault.transfer(msg.sender, shares);

        // First-time depositor this draw? Add to participant set.
        if (vault.balanceOf(msg.sender) == shares) {
            _participants[currentDrawId].add(msg.sender);
        } else {
            _participants[currentDrawId].add(msg.sender); // EnumerableSet dedupes.
        }

        emit TicketsPurchased(currentDrawId, msg.sender, shares);
    }

    // ─── Sponsor actions ────────────────────────────────────────────────────

    /// @notice Anyone can add USDC to the active draw's prize pool. This is
    ///         the MVP stand-in for yield-generated prizes.
    function fundPrizePool(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (block.timestamp >= draws[currentDrawId].endTime) revert DrawEnded();

        usdc.transferFrom(msg.sender, address(this), amount);
        draws[currentDrawId].prizeAmount += amount;

        emit PrizeFunded(currentDrawId, msg.sender, amount);
    }

    // ─── Draw lifecycle ─────────────────────────────────────────────────────

    /// @notice Anyone can close the active draw once the period is over.
    function closeDraw() external {
        Draw storage d = draws[currentDrawId];
        if (block.timestamp < d.endTime) revert DrawNotEnded();
        if (d.fulfilled) revert DrawAlreadyClosed();

        // Previous-block hash. Testnet-only; replace with VRF in production.
        uint256 randomWord = uint256(blockhash(block.number - 1));
        d.randomWord = randomWord;
        d.fulfilled = true;

        emit DrawClosed(currentDrawId, randomWord);

        _pickWinner(currentDrawId, randomWord);
        _startNewDraw();
    }

    /// @notice Starts the next draw period.
    function _startNewDraw() internal {
        currentDrawId += 1;
        Draw storage d = draws[currentDrawId];
        d.id = currentDrawId;
        d.startTime = block.timestamp;
        d.endTime = block.timestamp + drawInterval;

        emit DrawStarted(currentDrawId, d.startTime, d.endTime);
    }

    /// @notice Picks and pays the weighted winner for a closed draw.
    function _pickWinner(uint256 drawId, uint256 randomWord) internal {
        Draw storage d = draws[drawId];

        if (d.prizeAmount == 0) {
            emit WinnerPicked(drawId, address(0), 0);
            return;
        }

        address[] memory participants = _participants[drawId].values();
        if (participants.length == 0) {
            emit WinnerPicked(drawId, address(0), 0);
            return;
        }

        // Sum current tickets across participants. A participant with 0 shares
        // (withdrew everything) contributes 0 and is naturally skipped.
        uint256 totalTickets;
        uint256[] memory balances = new uint256[](participants.length);
        for (uint256 i; i < participants.length; i++) {
            balances[i] = vault.balanceOf(participants[i]);
            totalTickets += balances[i];
        }

        if (totalTickets == 0) {
            emit WinnerPicked(drawId, address(0), 0);
            return;
        }

        // Weighted-by-tickets selection.
        uint256 winningTicket = randomWord % totalTickets;
        uint256 cumulative;
        address winner;
        for (uint256 i; i < participants.length; i++) {
            cumulative += balances[i];
            if (winningTicket < cumulative) {
                winner = participants[i];
                break;
            }
        }
        if (winner == address(0)) {
            // Fallback if the loop fell through (shouldn't happen).
            winner = participants[0];
        }

        d.winner = winner;
        uint256 prize = d.prizeAmount;
        d.prizeAmount = 0;

        usdc.transfer(winner, prize);

        emit WinnerPicked(drawId, winner, prize);
    }

    // ─── Admin ─────────────────────────────────────────────────────────────

    /// @notice Owner can pull stuck USDC (e.g. if a transfer to winner failed
    ///         in a future version with pull-payouts). Safety valve only.
    function rescue(IERC20 token, address to, uint256 amount) external onlyOwner {
        token.transfer(to, amount);
    }
}
