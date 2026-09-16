# Liquidity and Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make withdrawals operationally independent of an owner and run Morpho and draw transitions through isolated, observable workers.

**Architecture:** Add an encrypted withdrawal-batch state machine, then package one keeper service with separate Morpho and draw workers sharing a managed transaction queue. Chain state remains authoritative; durable storage holds cursors, attempts, receipts, and reconciliation records.

**Tech Stack:** Solidity/Zama FHEVM, TypeScript, viem, Node 22, PostgreSQL-compatible storage, KMS-backed EVM signer or OpenZeppelin Relayer.

**Spec:** `docs/superpowers/specs/2026-09-16-mainnet-readiness-design.md`

## Global Constraints

- Individual withdrawal amounts remain encrypted.
- Only aggregate withdrawal batches may become public.
- A request stops contributing draw weight in the request transaction.
- Every worker action is idempotent and is simulated before submission.
- One transaction queue owns nonces for each signer.
- No mainnet raw private key is stored in environment variables.

---

### Task 1: Add the withdrawal request state machine

**Files:**
- Modify: `packages/contracts/contracts/ConfidentialPrizePool.sol`
- Modify: `packages/contracts/test/ConfidentialPrizePool.test.ts`
- Create: `packages/contracts/test/WithdrawalBatch.test.ts`

**Interfaces:**
- Produces: `requestWithdrawal(externalEuint64 amount, bytes proof) returns (uint256 batchId)`
- Produces: `requestWithdrawalToUsdc(externalEuint64 amount, bytes proof, address to) returns (uint256 batchId)`
- Produces: `encryptedPendingWithdrawalTotal()` and `withdrawalBatchState(uint256)`

- [ ] **Step 1: Add failing lifecycle tests**

Test request, capped request, removal from active principal, multiple requests in
one batch, cancellation prohibition after submission, and claim prohibition
before liquidity is ready.

- [ ] **Step 2: Verify red state**

Run: `cd packages/contracts && pnpm hardhat test test/WithdrawalBatch.test.ts`

Expected: FAIL because request and batch APIs do not exist.

- [ ] **Step 3: Implement encrypted liabilities**

Store each user's encrypted claim under a monotonically increasing batch ID.
Subtract the accepted amount from user and total active principal in the request
transaction. Increment a public request count but never emit the individual
amount.

- [ ] **Step 4: Add aggregate public-decryption handoff**

At a timed boundary, make the encrypted batch total publicly decryptable and
emit its handle. Accept the clear total only with a Zama signature proof and
replay-protected batch ID.

- [ ] **Step 5: Run focused and full tests**

Run: `cd packages/contracts && pnpm hardhat test test/WithdrawalBatch.test.ts && pnpm test`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/contracts/contracts/ConfidentialPrizePool.sol packages/contracts/test/ConfidentialPrizePool.test.ts packages/contracts/test/WithdrawalBatch.test.ts
git commit -m "feat(contracts): queue confidential withdrawal batches"
```

### Task 2: Restore batch liquidity and enable claims

**Files:**
- Modify: `packages/contracts/contracts/MorphoYieldAdapter.sol`
- Modify: `packages/contracts/contracts/ConfidentialPrizePool.sol`
- Modify: `packages/contracts/test/MorphoYieldAdapter.test.ts`
- Modify: `packages/contracts/test/WithdrawalBatch.test.ts`

**Interfaces:**
- Produces: `restoreWithdrawalBatch(uint256 batchId, uint64 total, bytes proof)`
- Produces: `claimWithdrawal(uint256 batchId)`
- Produces: `claimWithdrawalToUsdc(uint256 batchId)`

- [ ] **Step 1: Add failing liquidity and solvency tests**

Cover sufficient liquidity, temporarily insufficient Morpho liquidity, partial
operator failure, duplicate restoration, duplicate claim, and a user claiming
after subsequent deposits and draws.

- [ ] **Step 2: Verify red state**

Run: `cd packages/contracts && pnpm hardhat test test/WithdrawalBatch.test.ts --grep "liquidity"`

Expected: FAIL because batch restoration and claims do not exist.

- [ ] **Step 3: Implement exact batch restoration**

Verify the Zama proof, withdraw exactly the verified aggregate total from
Morpho, wrap it into confidential USDC, and mark the batch funded. Reverts must
leave the batch retryable and must not change liabilities.

- [ ] **Step 4: Implement confidential claims**

Transfer the stored encrypted claim once, clear it, and emit only account and
batch ID. For USDC output, initiate the existing wrapper unwrap flow without
publishing more information than the unavoidable finalized unwrap amount.

- [ ] **Step 5: Add conservation assertions**

After every tested transition, assert:

```text
active principal + pending withdrawal liabilities
= pool confidential liquidity + Morpho tracked principal
```

Account for harvested yield separately from principal.

- [ ] **Step 6: Run all contract tests and commit**

Run: `cd packages/contracts && pnpm test`

```bash
git add packages/contracts/contracts packages/contracts/test
git commit -m "feat(contracts): settle queued withdrawals from Morpho"
```

### Task 3: Split pure keeper planners

**Files:**
- Modify: `packages/web/src/lib/morpho-keeper.ts`
- Create: `packages/web/src/lib/draw-keeper.ts`
- Create: `packages/web/src/lib/withdrawal-keeper.ts`
- Modify: `packages/web/tests/morpho-keeper.test.mjs`
- Create: `packages/web/tests/draw-keeper.test.mjs`
- Create: `packages/web/tests/withdrawal-keeper.test.mjs`

**Interfaces:**
- Produces: `chooseDrawKeeperAction(snapshot): "close" | undefined`
- Produces: `chooseWithdrawalKeeperAction(snapshot): "request_decrypt" | "restore" | undefined`
- Preserves: one planned transaction per worker invocation

- [ ] **Step 1: Add failing planner tables**

Use table-driven tests for every state boundary, including deadline equality,
minimum-prize equality, empty rounds, pending proof, funded batches, Morpho
backlogs, and accrual timing.

- [ ] **Step 2: Verify red state**

Run: `cd packages/web && node --test tests/*keeper.test.mjs`

Expected: FAIL for missing draw and withdrawal planners.

- [ ] **Step 3: Implement side-effect-free planners**

Planners consume bigint snapshots and return at most one action. They do not
read environment variables, RPC state, time, or storage directly.

- [ ] **Step 4: Run planner and type gates**

Run: `cd packages/web && node --test tests/*keeper.test.mjs && pnpm typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/lib/*keeper.ts packages/web/tests/*keeper.test.mjs
git commit -m "refactor(keeper): isolate draw and liquidity planners"
```

### Task 4: Create independent workers with one transaction sender

**Files:**
- Create: `packages/keeper/package.json`
- Create: `packages/keeper/src/morpho-worker.ts`
- Create: `packages/keeper/src/draw-worker.ts`
- Create: `packages/keeper/src/transaction-sender.ts`
- Create: `packages/keeper/src/state-store.ts`
- Create: `packages/keeper/test/workers.test.ts`
- Remove after cutover: `packages/web/netlify/functions/morpho-keeper.ts`

**Interfaces:**
- Produces: `TransactionSender.send(request): Promise<{ hash: Hex }>`
- Produces: `StateStore` methods for cursor, attempt, receipt, and reconciliation records
- Consumes: pure planners from `packages/web/src/lib` or a moved shared package

- [ ] **Step 1: Add mocked worker failure tests**

Cover duplicate schedules, pending nonce, RPC timeout before broadcast, timeout
after broadcast, reverted receipt, relayer 500, reorged receipt, and worker
restart between each state transition.

- [ ] **Step 2: Verify red state**

Run: `pnpm --dir packages/keeper test`

Expected: FAIL because the keeper package does not exist.

- [ ] **Step 3: Implement the shared transaction queue**

Serialize by signer address, persist an idempotency key derived from chain ID,
contract, action, and state identifier, simulate before send, and record hash
before receipt polling. Never log RPC credentials, relayer secrets, proofs, or
private keys.

- [ ] **Step 4: Implement two worker schedules**

Run the draw worker every minute and the Morpho/withdrawal worker every five
minutes. Each has its own health timestamp, success/failure counters, latency,
last action, and oldest pending-state metrics.

- [ ] **Step 5: Add managed signer adapters**

Keep a local private-key adapter only for local/Sepolia development. Reject it
when `CHAIN_ID=1`. Add a KMS or OpenZeppelin Relayer adapter selected through
typed configuration and constrained to approved contract addresses and method
selectors.

- [ ] **Step 6: Run service gates and commit**

Run: `pnpm --dir packages/keeper test && pnpm --dir packages/keeper typecheck && pnpm --dir packages/keeper build`

```bash
git add packages/keeper packages/web/netlify/functions/morpho-keeper.ts
git commit -m "feat(keeper): run isolated draw and liquidity workers"
```

### Task 5: Add reconciliation and paging

**Files:**
- Create: `packages/keeper/src/reconcile.ts`
- Create: `packages/keeper/src/metrics.ts`
- Create: `packages/keeper/test/reconcile.test.ts`
- Create: `docs/runbooks/keeper-incident.md`

**Interfaces:**
- Produces: `reconcile(snapshot): ReconciliationResult`
- Produces alerts for stale worker, stuck proof, failed transaction, low gas,
  principal mismatch, prize mismatch, and withdrawal-SLO breach

- [ ] **Step 1: Add failing reconciliation fixtures**

Include healthy state and one fixture for every alert class. Use integer base
units only and require zero unexplained principal difference.

- [ ] **Step 2: Implement read-only reconciliation**

Compare contract liabilities, pool balances, adapter principal, Morpho position,
pending batches, and prize reserve. Persist block number and hash with every
report so reorged reports can be invalidated.

- [ ] **Step 3: Write and exercise the incident runbook**

Document alert ownership, diagnosis commands, pause criteria, signer failover,
RPC failover, proof retry, reconciliation recovery, and escalation to multisig.
Exercise each path on Sepolia and attach transaction evidence.

- [ ] **Step 4: Run tests and commit**

Run: `pnpm --dir packages/keeper test`

```bash
git add packages/keeper/src packages/keeper/test docs/runbooks/keeper-incident.md
git commit -m "feat(ops): reconcile keeper state and page failures"
```
