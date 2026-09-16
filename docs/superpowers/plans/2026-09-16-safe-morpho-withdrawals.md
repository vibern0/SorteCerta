# Safe Morpho Withdrawals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace unsafe immediate withdrawals with proof-bound, five-minute Morpho withdrawal batches that stay visible until the user's smart account receives USDC.

**Architecture:** `ConfidentialPrizePool` moves requested principal into encrypted per-user liabilities and publishes only two batch aggregates at close: total liability and the portion requiring Morpho restoration. A scheduled keeper proves and restores the exact shortfall; users claim funded liabilities into the existing USDC unwrap/finalization flow. The savings page reconstructs every pending stage from events and contract views.

**Tech Stack:** Solidity 0.8.27/0.8.28, Zama FHEVM 0.11.1, OpenZeppelin Confidential Contracts 0.5.3, Hardhat/Chai, TypeScript, viem, Next.js 14, Netlify scheduled functions, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-16-safe-morpho-withdrawals-design.md`

## Global Constraints

- Ethereum Sepolia (`11155111`) remains the only deployment network.
- Morpho is mandatory for the supported withdrawal path.
- The initial withdrawal batch interval is `300` seconds and remains constructor-configurable.
- Individual principal, request, and claim amounts remain encrypted; only batch aggregates become clear.
- Every address passed to a Zama SDK or relayer API must be checksum-normalized with `getAddress()` or equivalent.
- EIP-712 objects must serialize `bigint` values with the existing bigint-safe replacer.
- User-facing copy must not contain: encrypted, confidential, public, private, decrypted, mock, mocked, testnet, Sepolia, prototype, faucet, or leakage.
- The old Sepolia deployment and funds are not migrated.
- Use test-driven development: add one failing regression at a time, observe the expected failure, then implement the minimum behavior.

---

### Task 1: Make withdrawal requests lossless and disable legacy immediate paths

**Files:**
- Modify: `packages/contracts/contracts/ConfidentialPrizePool.sol`
- Modify: `packages/contracts/contracts/test/ConfidentialPrizePoolHarness.sol`
- Modify: `packages/contracts/test/ConfidentialPrizePool.test.ts`
- Modify: `packages/contracts/test/ConfidentialPrizePool.invariant.test.ts`
- Modify: `packages/contracts/test/WithdrawalBatch.test.ts`
- Modify: `packages/contracts/test/MorphoYieldAdapter.test.ts`

**Interfaces:**
- Consumes: existing `_principal`, `_totalPrincipal`, `_pendingMorphoPrincipal`, and configured `morphoYieldAdapter`.
- Produces: constructor `(IERC7984 token_, uint256 drawInterval_, uint256 withdrawalBatchInterval_)`, `requestWithdrawal(externalEuint64,bytes)`, `QueuedWithdrawalsOnly`, encrypted batch total, encrypted Morpho restore total, and legacy selectors that always revert.

- [ ] **Step 1: Add a regression that reproduces the zero-withdrawal incident**

Add this case to `WithdrawalBatch.test.ts`, using the existing Morpho fixture and encryption helpers:

```ts
it("never consumes principal through a legacy immediate withdrawal", async function () {
  const { alice, confidentialUsdc, pool, adapter } = await deployMorphoFixture();
  const poolAddress = await pool.getAddress();

  await encryptedDeposit(confidentialUsdc, poolAddress, alice, USDC(3));
  await ethers.provider.send("evm_increaseTime", [Number(MORPHO_UNWRAP_INTERVAL)]);
  await ethers.provider.send("evm_mine", []);
  const unwrapTx = await pool.requestMorphoPrincipalUnwrap();
  const unwrapReceipt = await unwrapTx.wait();
  const unwrapRequestId = unwrapReceipt!.logs
    .map((log) => {
      try { return confidentialUsdc.interface.parseLog(log); } catch { return undefined; }
    })
    .find((log) => log?.name === "UnwrapRequested")!.args.unwrapRequestId;
  const decrypted = await fhevm.publicDecrypt([unwrapRequestId]);
  await confidentialUsdc.finalizeUnwrap(
    unwrapRequestId,
    decrypted.clearValues[unwrapRequestId],
    decrypted.decryptionProof,
  );
  await pool.supplyAvailableMorphoPrincipal();

  const request = await fhevm.createEncryptedInput(poolAddress, alice.address).add64(USDC(3)).encrypt();
  const principalBefore = await pool.encryptedPrincipalOf(alice.address);
  const suppliedBefore = await adapter.suppliedPrincipal();

  await expect(
    pool.connect(alice).withdrawToUsdc(request.handles[0], request.inputProof, alice.address),
  ).to.be.revertedWithCustomError(pool, "QueuedWithdrawalsOnly");

  const principalAfter = await pool.encryptedPrincipalOf(alice.address);
  expect(await fhevm.userDecryptEuint(FhevmType.euint64, principalAfter, poolAddress, alice)).to.equal(
    await fhevm.userDecryptEuint(FhevmType.euint64, principalBefore, poolAddress, alice),
  );
  expect(await adapter.suppliedPrincipal()).to.equal(suppliedBefore);
});
```

Also change `MorphoYieldAdapter.test.ts` so its withdrawal-related test calls
`requestWithdrawal` rather than `withdraw`.

- [ ] **Step 2: Run the focused regression and confirm RED**

Run:

```bash
cd packages/contracts
pnpm hardhat test test/WithdrawalBatch.test.ts --grep "legacy immediate withdrawal"
```

Expected: FAIL because `withdrawToUsdc` does not revert with
`QueuedWithdrawalsOnly`.

- [ ] **Step 3: Add the batch accounting state and safe request transition**

In `ConfidentialPrizePool.sol`:

```solidity
enum WithdrawalBatchStatus { Open, Closed, Funded }

uint256 public immutable withdrawalBatchInterval;
mapping(uint256 => WithdrawalBatchStatus) private _withdrawalBatchStatus;
mapping(uint256 => uint256) private _withdrawalBatchClosesAt;
mapping(uint256 => euint64) private _withdrawalBatchMorphoRestore;
mapping(uint256 => uint256) private _withdrawalBatchClaimantCount;

error QueuedWithdrawalsOnly();
error MorphoYieldAdapterNotSet();
```

Change the constructor to initialize batch `1` and emit
`WithdrawalBatchOpened(1, block.timestamp + withdrawalBatchInterval_)`.
Update `ConfidentialPrizePoolHarness` and every pool deployment in
`ConfidentialPrizePool.test.ts`, `ConfidentialPrizePool.invariant.test.ts`,
`WithdrawalBatch.test.ts`, and `MorphoYieldAdapter.test.ts` to pass the shared
`WITHDRAWAL_BATCH_INTERVAL = 5n * 60n` test value so the repository compiles at
each TDD checkpoint.

Make both legacy functions retain their current ABI but immediately revert:

```solidity
function withdraw(externalEuint64, bytes calldata) external pure returns (euint64) {
    revert QueuedWithdrawalsOnly();
}

function withdrawToUsdc(externalEuint64, bytes calldata, address) external pure returns (bytes32) {
    revert QueuedWithdrawalsOnly();
}
```

Replace `_removePrincipal` with a helper returning both accepted and Morpho
portions:

```solidity
function _movePrincipalToWithdrawal(address account, euint64 requested)
    internal
    returns (euint64 accepted, euint64 morphoPortion)
{
    euint64 available = _principal[account];
    accepted = FHE.min(requested, available);
    euint64 liquidPortion = FHE.min(accepted, _pendingMorphoPrincipal);
    morphoPortion = FHE.sub(accepted, liquidPortion);

    _principal[account] = FHE.sub(available, accepted);
    _totalPrincipal = FHE.sub(_totalPrincipal, accepted);
    _pendingMorphoPrincipal = FHE.sub(_pendingMorphoPrincipal, liquidPortion);
    _allowAccount(_principal[account], account);
    FHE.allowThis(_totalPrincipal);
    FHE.allowThis(_pendingMorphoPrincipal);
}
```

Update `requestWithdrawal` to require a configured adapter, roll an expired
batch, add `accepted` to the user's claim and batch total, add `morphoPortion`
to `_withdrawalBatchMorphoRestore`, and increment claimant count only when the
account did not already have a claim in that batch.

- [ ] **Step 4: Run request-accounting tests and confirm GREEN**

Run:

```bash
cd packages/contracts
pnpm hardhat test test/WithdrawalBatch.test.ts test/MorphoYieldAdapter.test.ts
```

Expected: PASS, including assertions that active principal decreases exactly
as the encrypted claim increases and legacy selectors preserve all state.

- [ ] **Step 5: Commit the lossless request boundary**

```bash
git add packages/contracts/contracts/ConfidentialPrizePool.sol packages/contracts/contracts/test/ConfidentialPrizePoolHarness.sol packages/contracts/test/ConfidentialPrizePool.test.ts packages/contracts/test/ConfidentialPrizePool.invariant.test.ts packages/contracts/test/WithdrawalBatch.test.ts packages/contracts/test/MorphoYieldAdapter.test.ts
git commit -m "fix(contracts): make morpho withdrawals lossless"
```

---

### Task 2: Close batches and bind Morpho restoration to Zama proofs

**Files:**
- Modify: `packages/contracts/contracts/ConfidentialPrizePool.sol`
- Modify: `packages/contracts/test/WithdrawalBatch.test.ts`

**Interfaces:**
- Consumes: encrypted batch total and encrypted batch Morpho restore total from Task 1; `MorphoYieldAdapter.restorePrincipalToPool(uint256)`.
- Produces: `closeWithdrawalBatch(uint256)`, `settleWithdrawalBatch(uint256,uint64,uint64,bytes)`, batch status/view functions, and proof-bound `WithdrawalBatchFunded`.

- [ ] **Step 1: Add failing lifecycle and invalid-proof tests**

Add focused cases to `WithdrawalBatch.test.ts`:

```ts
it("closes only expired batches and makes both aggregates publicly decryptable", async function () {
  const { alice, confidentialUsdc, pool } = await deployMorphoFixture();
  const poolAddress = await pool.getAddress();
  await encryptedDeposit(confidentialUsdc, poolAddress, alice, USDC(3));
  await requestWithdrawal(pool, poolAddress, alice, USDC(2));

  await expect(pool.closeWithdrawalBatch(1n)).to.be.revertedWithCustomError(pool, "WithdrawalBatchNotReady");
  await ethers.provider.send("evm_increaseTime", [Number(WITHDRAWAL_BATCH_INTERVAL)]);
  await ethers.provider.send("evm_mine", []);
  await pool.closeWithdrawalBatch(1n);

  const total = await pool.encryptedWithdrawalBatchTotal(1n);
  const restore = await pool.encryptedWithdrawalBatchMorphoRestore(1n);
  const decrypted = await fhevm.publicDecrypt([total, restore]);
  expect(decrypted.clearValues[total]).to.equal(USDC(2));
});

it("rejects caller supplied settlement values that do not match the aggregate proof", async function () {
  const { alice, confidentialUsdc, pool } = await deployMorphoFixture();
  const poolAddress = await pool.getAddress();
  await encryptedDeposit(confidentialUsdc, poolAddress, alice, USDC(3));
  await requestWithdrawal(pool, poolAddress, alice, USDC(2));
  await ethers.provider.send("evm_increaseTime", [Number(WITHDRAWAL_BATCH_INTERVAL)]);
  await ethers.provider.send("evm_mine", []);
  await pool.closeWithdrawalBatch(1n);
  const total = await pool.encryptedWithdrawalBatchTotal(1n);
  const restore = await pool.encryptedWithdrawalBatchMorphoRestore(1n);
  const decrypted = await fhevm.publicDecrypt([total, restore]);
  const clearRestore = decrypted.clearValues[restore];
  await expect(
    pool.settleWithdrawalBatch(1n, USDC(1), clearRestore, decrypted.decryptionProof),
  ).to.be.reverted;
  expect(await pool.withdrawalBatchStatus(1n)).to.equal(1n); // Closed
});
```

Add cases for duplicate close, duplicate settlement, restore greater than total,
and a mixed batch where one request is backed by pool-reserved cUSDC while
another requires Morpho restoration.

- [ ] **Step 2: Run the lifecycle tests and confirm RED**

Run:

```bash
cd packages/contracts
pnpm hardhat test test/WithdrawalBatch.test.ts --grep "aggregates publicly|settlement values|mixed batch"
```

Expected: FAIL because the close/settle state machine and second aggregate do
not exist.

- [ ] **Step 3: Implement close, proof verification, and exact restoration**

Add these interfaces and errors to `ConfidentialPrizePool.sol`:

```solidity
function closeWithdrawalBatch(uint256 batchId) external;
function settleWithdrawalBatch(
    uint256 batchId,
    uint64 cleartextTotal,
    uint64 cleartextMorphoRestore,
    bytes calldata decryptionProof
) external returns (uint256 restoredAssets);

error WithdrawalBatchNotOpen(uint256 batchId);
error WithdrawalBatchNotClosed(uint256 batchId);
error WithdrawalBatchNotReady(uint256 readyAt);
error WithdrawalBatchEmpty(uint256 batchId);
error InvalidWithdrawalBatchAmounts(uint64 total, uint64 morphoRestore);
error WithdrawalRestorationMismatch(uint256 expected, uint256 actual);
```

`closeWithdrawalBatch` must set status before making the handles public, call
`FHE.makePubliclyDecryptable` for both handles, emit
`WithdrawalBatchClosed`, and open the next batch.

`settleWithdrawalBatch` must verify both handles in one proof:

```solidity
bytes32[] memory handles = new bytes32[](2);
handles[0] = euint64.unwrap(_withdrawalBatchTotal[batchId]);
handles[1] = euint64.unwrap(_withdrawalBatchMorphoRestore[batchId]);
FHE.checkSignatures(handles, abi.encode(cleartextTotal, cleartextMorphoRestore), decryptionProof);

uint256 restored = cleartextMorphoRestore == 0
    ? 0
    : _requireMorphoYieldAdapter().restorePrincipalToPool(cleartextMorphoRestore);
if (restored != cleartextMorphoRestore) {
    revert WithdrawalRestorationMismatch(cleartextMorphoRestore, restored);
}
```

Only after successful proof verification and restoration should it set status
to `Funded` and record the proven amounts. Delete
`markWithdrawalBatchFunded` and the old unproved `restoreWithdrawalBatch`.

- [ ] **Step 4: Run the full withdrawal suite and confirm GREEN**

Run:

```bash
cd packages/contracts
pnpm hardhat test test/WithdrawalBatch.test.ts
```

Expected: PASS for valid public proof settlement and every invalid transition.

- [ ] **Step 5: Commit proof-bound funding**

```bash
git add packages/contracts/contracts/ConfidentialPrizePool.sol packages/contracts/test/WithdrawalBatch.test.ts
git commit -m "feat(contracts): verify withdrawal batch funding"
```

---

### Task 3: Claim a funded liability directly into the USDC finalization flow

**Files:**
- Modify: `packages/contracts/contracts/ConfidentialPrizePool.sol`
- Modify: `packages/contracts/test/WithdrawalBatch.test.ts`
- Modify: `packages/contracts/test/ConfidentialPrizePool.invariant.test.ts`

**Interfaces:**
- Consumes: funded batch and exact pool cUSDC backing from Task 2; wrapper `unwrap(address,address,euint64)`.
- Produces: `claimWithdrawalToUsdc(uint256,address) returns (bytes32)`, `WithdrawalClaimedToUsdc`, and one-time claim semantics.

- [ ] **Step 1: Add a failing end-to-end claim/finalization test**

Add a test that deposits `3 USDC`, supplies it to Morpho, requests `2 USDC`,
closes and settles the batch with `fhevm.publicDecrypt`, then:

```ts
const claimTx = await pool.connect(alice).claimWithdrawalToUsdc(batchId, alice.address);
const receipt = await claimTx.wait();
const unwrapEvent = receipt!.logs
  .map((log) => {
    try { return confidentialUsdc.interface.parseLog(log); } catch { return undefined; }
  })
  .find((log) => log?.name === "UnwrapRequested");
const requestId = unwrapEvent!.args.unwrapRequestId;

const unwrapped = await fhevm.publicDecrypt([requestId]);
await confidentialUsdc.finalizeUnwrap(
  requestId,
  unwrapped.clearValues[requestId],
  unwrapped.decryptionProof,
);

expect(await usdc.balanceOf(alice.address)).to.equal(USDC(2));
expect(await pool.hasWithdrawalClaim(batchId, alice.address)).to.equal(false);
await expect(pool.connect(alice).claimWithdrawalToUsdc(batchId, alice.address))
  .to.be.revertedWithCustomError(pool, "NoWithdrawalClaim");
```

Add failure cases for an unfunded batch, zero receiver, another account's claim,
and a wrapper failure. Assert that every failed transaction leaves the claim
present.

- [ ] **Step 2: Run the claim tests and confirm RED**

Run:

```bash
cd packages/contracts
pnpm hardhat test test/WithdrawalBatch.test.ts --grep "claim.*USDC|leaves the claim"
```

Expected: FAIL because `claimWithdrawalToUsdc` does not exist.

- [ ] **Step 3: Implement checks-effects-interactions claim logic**

Implement:

```solidity
function claimWithdrawalToUsdc(uint256 batchId, address to) external returns (bytes32 unwrapRequestId) {
    if (_withdrawalBatchStatus[batchId] != WithdrawalBatchStatus.Funded) {
        revert WithdrawalBatchNotFunded(batchId);
    }
    if (!_hasWithdrawalClaim[batchId][msg.sender]) {
        revert NoWithdrawalClaim(batchId, msg.sender);
    }
    if (to == address(0)) revert InvalidWithdrawalReceiver();

    euint64 amount = _withdrawalClaims[batchId][msg.sender];
    _withdrawalClaims[batchId][msg.sender] = FHE.asEuint64(0);
    _hasWithdrawalClaim[batchId][msg.sender] = false;
    _withdrawalBatchClaimantCount[batchId]--;
    _allowAccount(_withdrawalClaims[batchId][msg.sender], msg.sender);
    FHE.allowTransient(amount, address(token));

    unwrapRequestId = IERC7984ERC20WrapperInternalAmount(address(token)).unwrap(address(this), to, amount);
    emit WithdrawalClaimedToUsdc(msg.sender, batchId, to, amount, unwrapRequestId);
}
```

Remove the old `claimWithdrawal` cUSDC path so every supported withdrawal ends
in USDC. Solidity revert atomicity preserves the claim if the wrapper call
fails.

- [ ] **Step 4: Add and run conservation invariants**

Extend `ConfidentialPrizePool.invariant.test.ts` with sequences covering:

```text
active principal + encrypted pending claims
== total accepted deposits - completed withdrawal claims
```

Also assert that prize claims do not change pending withdrawal totals and that
all users can claim in any order after a funded batch.

Run:

```bash
cd packages/contracts
pnpm hardhat test test/WithdrawalBatch.test.ts test/ConfidentialPrizePool.invariant.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the USDC claim path**

```bash
git add packages/contracts/contracts/ConfidentialPrizePool.sol packages/contracts/test/WithdrawalBatch.test.ts packages/contracts/test/ConfidentialPrizePool.invariant.test.ts
git commit -m "feat(contracts): claim funded withdrawals to usdc"
```

---

### Task 4: Implement the scheduled withdrawal keeper

**Files:**
- Modify: `packages/web/src/lib/withdrawal-keeper.ts`
- Modify: `packages/web/tests/withdrawal-keeper.test.mjs`
- Create: `packages/web/tests/withdrawal-keeper-runtime.test.mjs`
- Create: `packages/web/netlify/functions/withdrawal-keeper.ts`
- Modify: `packages/keeper/src/withdrawal-worker.mjs`
- Modify: `packages/keeper/test/workers.test.mjs`

**Interfaces:**
- Consumes: `withdrawalBatchStatus`, `withdrawalBatchClosesAt`, both encrypted aggregate handles, `closeWithdrawalBatch`, and `settleWithdrawalBatch`.
- Produces: pure actions `close | settle`, proof-forwarding scheduled function, one-minute schedule, and stable idempotency keys.

- [ ] **Step 1: Replace planner expectations with failing close/settle cases**

Change `withdrawal-keeper.test.mjs` to use:

```ts
const open = {
  now: 1_000n,
  closesAt: 900n,
  requestCount: 1n,
  status: "open",
};

test("closes an expired nonempty batch", () => {
  assert.equal(chooseWithdrawalKeeperAction(open), "close");
});

test("settles a closed batch and ignores funded or empty batches", () => {
  assert.equal(chooseWithdrawalKeeperAction({ ...open, status: "closed" }), "settle");
  assert.equal(chooseWithdrawalKeeperAction({ ...open, status: "funded" }), undefined);
  assert.equal(chooseWithdrawalKeeperAction({ ...open, requestCount: 0n }), undefined);
  assert.equal(chooseWithdrawalKeeperAction({ ...open, now: 899n }), undefined);
});
```

Update `workers.test.mjs` to expect encoded action data passed by the caller,
not the action name as calldata.

- [ ] **Step 2: Run planner tests and confirm RED**

Run:

```bash
node --test packages/web/tests/withdrawal-keeper.test.mjs
pnpm --dir packages/keeper test
```

Expected: FAIL because the planner still returns `request_decrypt | restore`.

- [ ] **Step 3: Implement the pure planner and generic worker boundary**

Use these types in `withdrawal-keeper.ts`:

```ts
export type WithdrawalBatchStatus = "open" | "closed" | "funded";
export type WithdrawalKeeperAction = "close" | "settle";
export type WithdrawalKeeperSnapshot = {
  now: bigint;
  closesAt: bigint;
  requestCount: bigint;
  status: WithdrawalBatchStatus;
};
```

Return `close` only for expired, nonempty open batches and `settle` for closed
batches. Change `runWithdrawalWorker` to accept `data` and include the action in
the idempotency key while sending the encoded calldata unchanged.

- [ ] **Step 4: Add failing runtime tests for proof forwarding and quiet retries**

Export `runWithdrawalKeeperOnce(deps)` from the new Netlify function and inject
`readBatches`, `publicDecrypt`, and `writeContract`. Test:

- close writes only `closeWithdrawalBatch(batchId)`;
- settle decrypts `[totalHandle, morphoRestoreHandle]` together and forwards
  both clear values plus the returned proof;
- a not-ready decrypt response sends no transaction;
- funded and empty batches stay quiet; and
- scanning never exceeds `WITHDRAWAL_KEEPER_BATCH_LOOKBACK`.

Run the new test file and confirm it fails because the function is absent.

- [ ] **Step 5: Implement the Netlify scheduled function**

Use checksum addresses and the Zama node SDK:

```ts
const decrypted = await zama.publicDecrypt([totalHandle, morphoRestoreHandle], {
  timeout: PUBLIC_DECRYPT_TIMEOUT_MS,
});
const total = decrypted.clearValues[totalHandle];
const restore = decrypted.clearValues[morphoRestoreHandle];

await walletClient.writeContract({
  address: pool,
  abi: withdrawalPoolAbi,
  account,
  chain: sepolia,
  functionName: "settleWithdrawalBatch",
  args: [batchId, total, restore, decrypted.decryptionProof],
});
```

Set:

```ts
export const config = { schedule: "* * * * *" };
```

Keep `PUBLIC_DECRYPT_TIMEOUT_MS` bounded and treat not-ready results as a quiet
retry. Use `WITHDRAWAL_KEEPER_BATCH_LOOKBACK` with a default of `20` and
`WITHDRAWAL_KEEPER_MAX_TXS` with a default of `2`.

- [ ] **Step 6: Run keeper tests and commit**

Run:

```bash
node --test packages/web/tests/withdrawal-keeper.test.mjs packages/web/tests/withdrawal-keeper-runtime.test.mjs
pnpm --dir packages/keeper test
```

Expected: PASS.

```bash
git add packages/web/src/lib/withdrawal-keeper.ts packages/web/tests/withdrawal-keeper.test.mjs packages/web/tests/withdrawal-keeper-runtime.test.mjs packages/web/netlify/functions/withdrawal-keeper.ts packages/keeper/src/withdrawal-worker.mjs packages/keeper/test/workers.test.mjs
git commit -m "feat(keeper): settle morpho withdrawal batches"
```

---

### Task 5: Show pending liabilities through final USDC receipt

**Files:**
- Modify: `packages/web/src/lib/contracts.ts`
- Create: `packages/web/src/lib/withdrawal-state.ts`
- Create: `packages/web/tests/withdrawal-state.test.mjs`
- Modify: `packages/web/src/app/savings/page.tsx`

**Interfaces:**
- Consumes: withdrawal events/views from Tasks 1-3 and existing unwrap event tracker.
- Produces: `PendingWithdrawal`, `deriveWithdrawalStage`, event reconciliation, request/claim actions, and persistent pending UI.

- [ ] **Step 1: Add failing pure state-model tests**

Define the desired public API in `withdrawal-state.test.mjs`:

```ts
test("keeps a withdrawal visible from request through unwrap finalization", () => {
  const request = { batchId: 4n, txHash: "0xrequest", amount: 2_000_000n };
  assert.equal(deriveWithdrawalStage(request, { batchStatus: "open", hasClaim: true }), "requested");
  assert.equal(deriveWithdrawalStage(request, { batchStatus: "closed", hasClaim: true }), "preparing");
  assert.equal(deriveWithdrawalStage(request, { batchStatus: "funded", hasClaim: true }), "claimable");
  assert.equal(deriveWithdrawalStage(request, { batchStatus: "funded", hasClaim: false, unwrapPending: true }), "finalizing");
  assert.equal(deriveWithdrawalStage(request, { batchStatus: "funded", hasClaim: false, unwrapPending: false }), "complete");
});

test("never treats a zero-value finalization as success", () => {
  assert.equal(finalizationOutcome(0n), "invariant-error");
  assert.equal(finalizationOutcome(2_000_000n), "complete");
});
```

Add a copy scan asserting all strings rendered for these stages pass the
existing `hasForbiddenProductCopy` rule.

- [ ] **Step 2: Run the state tests and confirm RED**

Run:

```bash
node --test packages/web/tests/withdrawal-state.test.mjs
```

Expected: FAIL because `withdrawal-state.ts` is absent.

- [ ] **Step 3: Implement the state model and ABI**

Add ABI fragments for:

```text
requestWithdrawal(bytes32,bytes)
claimWithdrawalToUsdc(uint256,address)
withdrawalBatchStatus(uint256)
withdrawalBatchClosesAt(uint256)
hasWithdrawalClaim(uint256,address)
WithdrawalRequested
WithdrawalBatchClosed
WithdrawalBatchFunded
WithdrawalClaimedToUsdc
```

Implement:

```ts
export type WithdrawalStage = "requested" | "preparing" | "claimable" | "finalizing" | "complete";
export type PendingWithdrawal = {
  batchId: bigint;
  txHash: `0x${string}`;
  amount?: bigint;
  unwrapRequestId?: `0x${string}`;
};
```

`deriveWithdrawalStage` must be a pure exhaustive mapping. Event reconciliation
must deduplicate by `(account,batchId)`, prefer chain events over local storage,
and retain a locally known amount without publishing it.

- [ ] **Step 4: Replace the savings-page transaction flow**

In `withdrawConfidential`, encode `requestWithdrawal`, parse its
`WithdrawalRequested` event, persist `{batchId,txHash,amount}`, and show
"Withdrawal requested." Do not create an unwrap item at this step.

Add `claimWithdrawal(batchId)` that calls
`claimWithdrawalToUsdc(batchId,user)`, parses `UnwrapRequested`, connects its
request ID to the pending batch, and then reuses the existing
`finalizeUnwrap` action.

Render a pending card for every non-complete item:

```text
Withdrawal requested
Preparing your funds
Ready to receive       [Receive USDC]
Finalizing withdrawal  [Finalize withdrawal]
```

Only show the amount when it is locally known. Refresh batch status after every
transaction and when the page regains focus. Never show final success for a
zero-value `UnwrapFinalized` event.

- [ ] **Step 5: Run state, type, and build gates**

Run:

```bash
node --test packages/web/tests/*.test.mjs
pnpm --dir packages/web typecheck
pnpm --dir packages/web build
```

Expected: PASS with no forbidden product copy.

- [ ] **Step 6: Commit the pending withdrawal UX**

```bash
git add packages/web/src/lib/contracts.ts packages/web/src/lib/withdrawal-state.ts packages/web/tests/withdrawal-state.test.mjs packages/web/src/app/savings/page.tsx
git commit -m "feat(web): track withdrawals until usdc receipt"
```

---

### Task 6: Create a clean confidential Sepolia deployment path

**Files:**
- Modify: `packages/contracts/scripts/deploy.ts`
- Modify: `packages/contracts/scripts/deploy-confidential-pool.ts`
- Create: `packages/contracts/test/SepoliaDeployment.test.ts`
- Modify: `packages/contracts/.env.example`
- Modify: `packages/web/.env.example`
- Modify: `README.md`
- Create: `docs/evidence/sepolia-safe-withdrawals.md`

**Interfaces:**
- Consumes: new pool constructor and mandatory adapter configuration.
- Produces: fresh wrapper/pool/adapter addresses, `WITHDRAWAL_BATCH_INTERVAL_SECONDS`, keeper start block, and reproducible verification evidence.

- [ ] **Step 1: Add a failing deployment smoke test**

Create a Hardhat test that deploys the same stack as the script with:

```ts
const pool = await ConfidentialPrizePool.deploy(
  await confidentialUsdc.getAddress(),
  900n,
  300n,
);
```

Assert the adapter is nonzero after setup, the interval is `300`, the first
batch is open, and both legacy withdrawal methods revert. Run it before editing
the scripts and confirm constructor/setup failure.

- [ ] **Step 2: Replace the plaintext deploy entrypoint**

Rewrite `packages/contracts/scripts/deploy.ts` to deploy, in order:

1. `ConfidentialUSDC` over checksum-normalized Circle Sepolia USDC;
2. `ConfidentialPrizePool(token, drawInterval, withdrawalBatchInterval)`;
3. `MorphoYieldAdapter` for the configured registered market; and
4. `pool.setMorphoYieldAdapter(adapter, morphoUnwrapInterval)`.

Require these defaults:

```text
DRAW_INTERVAL_SECONDS=900
WITHDRAWAL_BATCH_INTERVAL_SECONDS=300
MORPHO_UNWRAP_INTERVAL_SECONDS=300
```

Print checksum addresses and the deployment block in a machine-copyable JSON
object. Do not deploy the old `Vault` or plaintext `PrizePool`.

- [ ] **Step 3: Update environment templates and technical documentation**

Add the withdrawal keeper variables to `.env.example`, document the pending
withdrawal lifecycle and aggregate leakage in `README.md`, and explicitly mark
the prior Sepolia addresses as superseded after deployment. Keep restricted
terms out of UI source; technical docs may use them.

- [ ] **Step 4: Run the complete local verification gate**

Run:

```bash
pnpm --dir packages/contracts compile
pnpm --dir packages/contracts test
pnpm --dir packages/keeper test
node --test packages/web/tests/*.test.mjs
pnpm --dir packages/web typecheck
pnpm --dir packages/web build
```

Expected: all commands exit `0`.

- [ ] **Step 5: Deploy and verify the fresh Sepolia stack**

Run the confidential deployment with the configured deployer:

```bash
pnpm --dir packages/contracts deploy:sepolia
```

Update Netlify's public contract variables and keeper variables together. Do
not point the live app at the new pool until the keeper has the same address and
start block.

Execute the clean-account acceptance cycle from the spec and record checksummed
addresses, transaction hashes, batch ID, requested amount, restored amount,
final USDC balance delta, and live URL in
`docs/evidence/sepolia-safe-withdrawals.md`.

- [ ] **Step 6: Commit deployment evidence**

```bash
git add packages/contracts/scripts/deploy.ts packages/contracts/scripts/deploy-confidential-pool.ts packages/contracts/.env.example packages/web/.env.example README.md docs/evidence/sepolia-safe-withdrawals.md
git commit -m "chore(deploy): publish safe withdrawal stack"
```

---

### Task 7: Review the final withdrawal diff and stop

**Files:**
- Review: every file changed in Tasks 1-6

**Interfaces:**
- Consumes: all implemented withdrawal behavior.
- Produces: evidence that the incident cannot recur through any exposed path.

- [ ] **Step 1: Inspect exposed contract selectors and frontend callers**

Use `rg` to prove there is no caller of `withdraw` or `withdrawToUsdc` and no
owner-only batch-funding bypass:

```bash
rg -n "withdrawToUsdc|markWithdrawalBatchFunded|restoreWithdrawalBatch" packages --glob '!**/artifacts/**' --glob '!**/cache/**'
```

Expected: only regression tests, ABI compatibility reverts, or migration notes;
no production caller or funding bypass.

- [ ] **Step 2: Re-run the incident regression alone**

```bash
cd packages/contracts
pnpm hardhat test test/WithdrawalBatch.test.ts --grep "legacy immediate withdrawal"
```

Expected: PASS and no state change after the reverted call.

- [ ] **Step 3: Re-run all project gates**

```bash
pnpm --dir packages/contracts compile
pnpm --dir packages/contracts test
pnpm --dir packages/keeper test
node --test packages/web/tests/*.test.mjs
pnpm --dir packages/web typecheck
pnpm --dir packages/web build
```

Expected: all commands exit `0` with no unexpected warnings.

- [ ] **Step 4: Compare deployed evidence with acceptance conditions**

Confirm the evidence document proves:

- request confirmation does not claim payment;
- the pending item survives refresh;
- the batch proof values equal the funded values;
- the claim creates a nonzero unwrap;
- finalization increases wallet USDC by the requested amount; and
- the old deployment is not referenced by the live frontend or keeper.

- [ ] **Step 5: Commit any evidence-only correction and stop**

If no correction is needed, do not create an empty commit. Do not add unrelated
refactors, features, or mainnet work.
