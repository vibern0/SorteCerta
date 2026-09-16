# Protocol Correctness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a mainnet-candidate pool with mathematically correct confidential draws, explicit round eligibility, production governance, and emergency controls.

**Architecture:** Replace the fixed ticket range with a 128-bit encrypted scaling calculation, gate draw closure on deadline/participants/minimum prize, and move privileged actions to role-based multisig/timelock control. Deploy this as a new contract generation; do not mutate the live Sepolia deployment.

**Tech Stack:** Solidity 0.8.28, Zama FHEVM, OpenZeppelin Contracts 5, Hardhat, TypeScript, Chai.

**Spec:** `docs/superpowers/specs/2026-09-16-mainnet-readiness-design.md`

## Global Constraints

- Preserve encrypted individual principal and winnings.
- Winner selection must remain onchain and use Zama FHE randomness.
- `MAX_PARTICIPANTS` remains 32 until measured HCU and gas results justify a change.
- Deposits can be paused; withdrawal requests and prize claims cannot be paused.
- Mainnet contracts are new deployments and must not reuse Sepolia addresses.
- Every change follows red-green-refactor TDD and receives an independent review.

---

### Task 1: Prove unbiased ticket scaling

**Files:**
- Modify: `packages/contracts/contracts/ConfidentialPrizePool.sol`
- Modify: `packages/contracts/test/ConfidentialPrizePool.test.ts`
- Create: `packages/contracts/test/ConfidentialPrizePool.invariant.test.ts`

**Interfaces:**
- Produces: `_scaledRandomTicket(euint64 randomWord, euint64 totalPrincipal) returns (euint128)`
- Produces: draw comparisons performed in `euint128`

- [ ] **Step 1: Add failing boundary tests**

Add cases with deposits `1`, `1_048_576`, `1_048_577`, `1_000_000_000`, and
32 users at the account cap. Assert every selected encrypted ticket is less than
encrypted total principal after test-only decryption.

- [ ] **Step 2: Run the focused test and verify the current implementation fails**

Run: `cd packages/contracts && pnpm hardhat test test/ConfidentialPrizePool.invariant.test.ts`

Expected: FAIL because the existing ticket is sampled from the fixed
`MAX_DRAW_TICKETS` range instead of the encrypted principal range.

- [ ] **Step 3: Implement 128-bit scaling**

Replace the fixed bound with the equivalent of:

```solidity
euint64 randomWord = FHE.randEuint64();
euint128 product = FHE.mul(FHE.asEuint128(randomWord), FHE.asEuint128(_totalPrincipal));
euint128 ticket = FHE.shr(product, 64);
```

Widen cumulative principal and participant principal before comparisons. Add a
constructor or compile-time assertion proving maximum aggregate principal is
less than `2^64`.

- [ ] **Step 4: Add distribution property tests**

For deterministic mocked random samples, test equal deposits, 1:3 deposits,
registration-order reversal, zero-principal former participants, and maximum
aggregate principal. Compare observed buckets with exact interval membership,
not statistical tolerance.

- [ ] **Step 5: Run contract tests**

Run: `cd packages/contracts && pnpm test`

Expected: all confidential pool, wrapper, adapter, and invariant tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/contracts/contracts/ConfidentialPrizePool.sol packages/contracts/test/ConfidentialPrizePool.test.ts packages/contracts/test/ConfidentialPrizePool.invariant.test.ts
git commit -m "fix(contracts): make confidential draw weighting unbiased"
```

### Task 2: Define executable round eligibility

**Files:**
- Modify: `packages/contracts/contracts/ConfidentialPrizePool.sol`
- Modify: `packages/contracts/test/ConfidentialPrizePool.test.ts`
- Modify: `packages/contracts/scripts/deploy-confidential-pool.ts`

**Interfaces:**
- Produces: `minimumPrize() view returns (uint64)`
- Produces: `canCloseDraw() view returns (bool ready, uint8 reason)`
- Consumes: public `nextDrawAt`, `participantCount()`, and `publicPrizeReserve`

- [ ] **Step 1: Add failing eligibility tests**

Cover: early deadline, zero participants, prize below minimum, exact minimum,
and a past-due executable round. Assert below-threshold rounds remain open.

- [ ] **Step 2: Verify red state**

Run: `cd packages/contracts && pnpm hardhat test test/ConfidentialPrizePool.test.ts --grep "round eligibility"`

Expected: FAIL because `minimumPrize` and `canCloseDraw` do not exist.

- [ ] **Step 3: Add immutable minimum prize and reason codes**

Use `0=ready`, `1=before deadline`, `2=no participants`, and
`3=prize below minimum`. Make `closeDraw()` reuse the same internal predicate so
offchain simulation and execution cannot diverge.

- [ ] **Step 4: Update deployment input validation**

Require `MINIMUM_PRIZE_USDC` and reject zero, values above `uint64`, and values
that are not valid six-decimal USDC base units. Print the chosen value in the
deployment manifest without printing secrets.

- [ ] **Step 5: Run compile and tests**

Run: `cd packages/contracts && pnpm compile && pnpm test`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/contracts/contracts/ConfidentialPrizePool.sol packages/contracts/test/ConfidentialPrizePool.test.ts packages/contracts/scripts/deploy-confidential-pool.ts
git commit -m "feat(contracts): gate draws on an economic prize threshold"
```

### Task 3: Replace immutable owner with production roles

**Files:**
- Modify: `packages/contracts/contracts/ConfidentialPrizePool.sol`
- Modify: `packages/contracts/contracts/MorphoYieldAdapter.sol`
- Modify: `packages/contracts/test/ConfidentialPrizePool.test.ts`
- Modify: `packages/contracts/test/MorphoYieldAdapter.test.ts`

**Interfaces:**
- Produces: `DEFAULT_ADMIN_ROLE`, `PAUSER_ROLE`, and `YIELD_MANAGER_ROLE`
- Produces: `pauseDeposits()`, `unpauseDeposits()`, and `depositsPaused()`
- Preserves: permissionless `closeDraw()`, harvest, and safe supply helpers

- [ ] **Step 1: Add failing authorization tests**

Prove unauthorized accounts cannot change adapters, intervals, caps, pause
state, or restore arbitrary principal. Prove pause blocks deposits but permits
withdrawal requests and prize claims.

- [ ] **Step 2: Verify red state**

Run: `cd packages/contracts && pnpm hardhat test --grep "production roles"`

Expected: FAIL because the immutable owner cannot transfer administration and
pause controls do not exist.

- [ ] **Step 3: Implement AccessControl and Pausable semantics**

Initialize admin to the constructor-provided timelock address. Assign pausing
and yield configuration to distinct roles. Do not give the operational keeper
an admin role. Emit events for every configuration and pause transition.

- [ ] **Step 4: Test Safe/timelock-shaped administration**

Use separate test signers for timelock, Safe proposer, pauser, yield manager,
keeper, and participant. Assert role revocation takes effect immediately and
renouncing the final admin is rejected unless a successor admin exists.

- [ ] **Step 5: Run tests and gas report**

Run: `cd packages/contracts && pnpm test && REPORT_GAS=true pnpm hardhat test test/ConfidentialPrizePool.test.ts`

Expected: PASS with recorded gas/HCU evidence for deposit, close, claim, and
withdrawal-request paths.

- [ ] **Step 6: Commit**

```bash
git add packages/contracts/contracts/ConfidentialPrizePool.sol packages/contracts/contracts/MorphoYieldAdapter.sol packages/contracts/test
git commit -m "feat(contracts): add mainnet governance and emergency roles"
```

### Task 4: Update frontend contract model and round states

**Files:**
- Modify: `packages/web/src/lib/contracts.ts`
- Modify: `packages/web/src/app/draw/page.tsx`
- Modify: `packages/web/src/lib/usePoolData.ts`
- Create: `packages/web/tests/draw-state.test.mjs`
- Create: `packages/web/src/lib/draw-state.ts`

**Interfaces:**
- Produces: `deriveDrawState({ now, nextDrawAt, participants, prize, minimumPrize })`
- Produces states: `scheduled`, `building_prize`, and `ready_to_close`

- [ ] **Step 1: Add failing pure-model tests**

Test the deadline and threshold boundaries and ensure the UI never claims a
winner or prize entitlement before a round closes.

- [ ] **Step 2: Run and verify failure**

Run: `cd packages/web && node --test tests/draw-state.test.mjs`

Expected: FAIL because the model does not exist.

- [ ] **Step 3: Implement the model and ABI reads**

Read `minimumPrize` and `canCloseDraw`. Render the scheduled countdown before
the deadline and “Prize building” after the deadline when the threshold is not
met. Keep implementation/privacy terminology out of user-facing copy.

- [ ] **Step 4: Run frontend gates**

Run: `cd packages/web && node --test tests/*.test.mjs test/*.test.mjs && pnpm typecheck && pnpm build`

Expected: all tests, typecheck, and production build PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/lib/contracts.ts packages/web/src/lib/usePoolData.ts packages/web/src/lib/draw-state.ts packages/web/src/app/draw/page.tsx packages/web/tests/draw-state.test.mjs
git commit -m "feat(web): show executable mainnet round states"
```
