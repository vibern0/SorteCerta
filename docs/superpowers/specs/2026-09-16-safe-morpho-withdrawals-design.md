# Safe Morpho Withdrawals Design

## Status

Approved on September 16, 2026.

## Objective

Replace SorteCerta's unsafe immediate withdrawal path with one mandatory,
Morpho-aware withdrawal state machine. A withdrawal request must immediately
stop the requested principal from participating in draws, preserve the same
amount as a user-owned liability, restore exactly the required liquidity from
Morpho, and remain visible in the app until USDC reaches the user's smart
account.

This is a fresh Sepolia deployment. The old deployment and its stranded funds
will not be migrated or compensated by this change.

## Incident and root cause

The deployed frontend called `withdrawToUsdc` while all principal liquidity was
supplied through `MorphoYieldAdapter`. `ConfidentialPrizePool` first reduced the
user's encrypted principal by the requested amount. The ERC-7984 wrapper then
capped its burn to the pool's available cUSDC balance, which was zero. The
unwrap finalized successfully with a cleartext value of zero.

The bug crossed two accounting domains:

1. The pool treated a requested encrypted amount as paid before it knew how
   much the wrapper actually burned.
2. The frontend exposed an immediate path even when liquidity had to be
   restored from Morpho.

The replacement design never equates "requested" with "paid". Active principal,
pending withdrawal liabilities, restored liquidity, and completed claims are
separate states.

## Product behavior

Users request a withdrawal immediately. The request moves into a visible
pending state and leaves draw eligibility at once. Requests are grouped into a
configurable batch whose initial Sepolia interval is five minutes.

The savings screen shows one of these states until the withdrawal completes:

1. **Withdrawal requested** — the request is recorded in the current batch.
2. **Preparing your funds** — the batch is closed and its aggregate liquidity
   is being restored.
3. **Ready to receive** — exact liquidity is present and the user can claim.
4. **Finalizing withdrawal** — the claim created an unwrap request and awaits
   finalization.

The existing product-copy restrictions continue to apply. The UI must not use
implementation or privacy terminology such as the network name, Morpho,
encrypted/decrypted, public/private, mock, testnet, or prototype. Technical
details remain available in developer documentation.

The five-minute interval is configuration, not a protocol constant. The
contract stores an immutable `withdrawalBatchInterval`; Sepolia deployment
starts at `300` seconds. The keeper runs every minute, so a healthy batch is
normally closed within one minute after its deadline and settled as soon as
public decryption is available.

## Contract architecture

### Mandatory Morpho path

`ConfidentialPrizePool` retains the adapter setter because the pool and adapter
have a circular deployment dependency, but user withdrawals are unavailable
until a nonzero adapter is configured. There is no supported non-Morpho
withdrawal mode.

The legacy `withdraw` and `withdrawToUsdc` selectors remain temporarily as
explicit reverts with `QueuedWithdrawalsOnly()`. Keeping the selectors makes a
stale frontend fail safely and clearly instead of invoking an unknown fallback
or silently using old behavior.

### Batch lifecycle

Each batch has an explicit status:

```text
Open -> Closed -> Funded
```

- `Open`: accepts encrypted user requests until `closesAt`.
- `Closed`: accepts no more requests; aggregate handles are publicly
  decryptable.
- `Funded`: the contract verified the aggregate proof and restored the exact
  Morpho shortfall. Individual claims may now create USDC unwrap requests.

The first batch opens in the pool constructor. Any account may close an expired
nonempty batch. If a user submits after an expired batch, the request transaction
rolls the old batch forward before adding the new request, preventing a stale
keeper from blocking withdrawals. Empty expired batches advance without a
public decryption request.

### Accounting on request

`requestWithdrawal(encryptedAmount, inputProof)` computes:

```text
accepted        = min(requested, activePrincipal[user])
liquidPortion   = min(accepted, pendingMorphoPrincipal)
morphoPortion   = accepted - liquidPortion
```

It then atomically:

- subtracts `accepted` from the user's active principal and total active
  principal;
- subtracts `liquidPortion` from pending Morpho principal, leaving those cUSDC
  tokens reserved in the pool;
- adds `accepted` to the user's encrypted claim and batch encrypted total;
- adds `morphoPortion` to the batch encrypted restore total; and
- records a public request count and claimant count without exposing either
  individual amount.

The accepted amount is never destroyed. It moves from active principal to the
user's claim in the same transaction.

### Closing and verified funding

`closeWithdrawalBatch(batchId)` marks both encrypted aggregates publicly
decryptable:

- total withdrawal liability; and
- amount that must be restored from Morpho.

The keeper obtains the two clear values and one Zama decryption proof, then
calls:

```solidity
settleWithdrawalBatch(
    uint256 batchId,
    uint64 cleartextTotal,
    uint64 cleartextMorphoRestore,
    bytes calldata decryptionProof
)
```

The contract verifies the proof against both stored handles with
`FHE.checkSignatures`. It rejects settlement unless:

- the batch is closed and not already funded;
- `cleartextMorphoRestore <= cleartextTotal`;
- the proof binds both clear values to the batch handles; and
- `MorphoYieldAdapter.restorePrincipalToPool` returns exactly
  `cleartextMorphoRestore`.

The contract records `cleartextTotal` as funded only after those checks pass.
The previous owner-controlled `markWithdrawalBatchFunded` path is removed.

### Claiming to USDC

`claimWithdrawalToUsdc(batchId, to)` is available only on a funded batch and
only to an account with a claim. It clears the user's claim before external
calls, grants the wrapper transient access, and calls the wrapper's internal
encrypted-amount unwrap method. The returned request ID is emitted with the
account, receiver, batch ID, and encrypted claim handle.

Because settlement reserves the pool-held liquid portion and restores the
proven Morpho portion, the pool holds the exact aggregate cUSDC needed for all
claims in the batch. Prize accounting remains separate and cannot mark a
withdrawal batch funded.

The existing wrapper finalization flow remains unchanged: the app or keeper
publicly decrypts the unwrap request and submits `finalizeUnwrap`, which sends
USDC to the requested smart account.

### Required views and events

The pool exposes:

```solidity
enum WithdrawalBatchStatus { Open, Closed, Funded }

function withdrawalBatchStatus(uint256 batchId) external view returns (WithdrawalBatchStatus);
function withdrawalBatchClosesAt(uint256 batchId) external view returns (uint256);
function withdrawalBatchRequestCount(uint256 batchId) external view returns (uint256);
function withdrawalBatchClaimantCount(uint256 batchId) external view returns (uint256);
function encryptedWithdrawalBatchTotal(uint256 batchId) external view returns (euint64);
function encryptedWithdrawalBatchMorphoRestore(uint256 batchId) external view returns (euint64);
function encryptedWithdrawalClaimOf(uint256 batchId, address account) external view returns (euint64);
function hasWithdrawalClaim(uint256 batchId, address account) external view returns (bool);
```

The state machine emits:

```solidity
event WithdrawalBatchOpened(uint256 indexed batchId, uint256 closesAt);
event WithdrawalRequested(address indexed account, uint256 indexed batchId, euint64 indexed amount);
event WithdrawalBatchClosed(uint256 indexed batchId, euint64 total, euint64 morphoRestoreTotal);
event WithdrawalBatchFunded(uint256 indexed batchId, uint64 total, uint64 morphoRestored);
event WithdrawalClaimedToUsdc(
    address indexed account,
    uint256 indexed batchId,
    address indexed to,
    euint64 amount,
    bytes32 unwrapRequestId
);
```

## Keeper behavior

A dedicated withdrawal worker runs every minute and scans a bounded recent
batch window.

For each batch it performs at most one state transition per invocation:

- expired `Open` batch with requests: call `closeWithdrawalBatch`;
- `Closed` batch: publicly decrypt both aggregate handles and call
  `settleWithdrawalBatch` with their proof;
- `Funded` or empty current batch: do nothing.

Actions are idempotent by `(pool, batchId, action)`. A decryption result that is
not ready is not an error and produces no transaction. Invalid proofs,
restoration mismatches, and transaction failures are logged with the batch ID
and do not advance local state.

The existing Morpho worker continues finalizing deposit unwraps, supplying
available principal, accruing interest, and harvesting yield. The withdrawal
worker is the sole caller of batch settlement; the contract remains
permissionless because proof verification, rather than keeper identity, is the
security boundary.

## Frontend behavior

The savings page replaces `withdrawToUsdc` with `requestWithdrawal`. It parses
the `WithdrawalRequested` event, stores the batch ID and transaction hash, and
refreshes pending requests from indexed account events so state survives a new
browser session.

For each discovered batch:

- `Open` displays **Withdrawal requested** and the expected batch time;
- `Closed` displays **Preparing your funds**;
- `Funded` plus `hasWithdrawalClaim == true` displays **Ready to receive** and
  a claim action;
- after `WithdrawalClaimedToUsdc`, the existing unwrap tracker displays
  **Finalizing withdrawal** and its finalization action;
- after `UnwrapFinalized`, the item disappears and balances refresh.

The app must never report success merely because the request transaction
confirmed. Confirmation copy says the withdrawal was requested. Only an
`UnwrapFinalized` event with a nonzero cleartext amount produces final success
copy. A zero finalization is treated as an invariant violation and displayed as
an actionable failure rather than success.

## Invariants

Tests and review must preserve these invariants:

1. A request reduces active principal by exactly the amount added to the user's
   pending claim.
2. A user's claim cannot disappear before a funded claim transaction succeeds.
3. A batch cannot become funded from caller-supplied numbers without a valid
   proof for both aggregate handles.
4. Reserved pool liquidity plus restored Morpho liquidity equals the proven
   cleartext batch total.
5. Each claim can be consumed once.
6. Failed close, proof, restoration, unwrap, or finalization calls leave the
   relevant liability claimable.
7. Prize funds are never counted as restored principal.
8. Legacy immediate withdrawal selectors always revert.
9. The frontend never labels a request or zero-value finalization as a completed
   withdrawal.

## Testing strategy

Contract regression tests reproduce the production incident: principal is
supplied to Morpho, a user attempts the legacy immediate path, the call reverts,
and both principal and adapter assets remain unchanged. Batch tests cover
multiple users, repeated requests by one user, pending in-pool principal,
Morpho-restored principal, invalid proof/value pairs, underfunding, duplicate
settlement, duplicate claims, and claim-to-USDC finalization.

Pure planner tests cover every keeper status and idempotency key. Netlify
function tests cover not-ready public decryption, proof forwarding, bounded
batch scanning, and quiet no-op runs. Frontend model tests cover status mapping,
event reconciliation, local-storage recovery, claim transitions, zero-value
finalization, and permitted product copy. Existing contract, keeper, web
typecheck, and production build gates remain required.

## Deployment

Deployment creates a fresh confidential wrapper, pool, and Morpho adapter on
Ethereum Sepolia, configures a `300`-second withdrawal batch interval, and then
updates the frontend and keeper addresses together. Every address passed to
Zama or the relayer is checksum-normalized.

Before the live app is switched, a clean smart account completes this exact
cycle on the new deployment:

1. deposit USDC;
2. finalize and supply principal into Morpho;
3. request a withdrawal;
4. observe the pending item;
5. close and settle its batch;
6. claim to USDC;
7. finalize the unwrap; and
8. verify the wallet's USDC increase equals the requested amount.

The previous Sepolia deployment stays documented as superseded. No storage,
principal, prizes, or withdrawal claims are migrated.
