# Shared Protocol Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `@sortecerta/protocol` as the single SDK-backed implementation of shared Morpho types, math, decoding, pinned reads, ABIs, and amount parsing used by web, Morpho lab, and keepers.

**Architecture:** The package exposes TypeScript source to existing workspace consumers and wraps only the official Morpho primitives needed for the custom Sepolia deployment. Consumers continue to create clients, select blocks, manage wallets, submit transactions, and own UI state; the shared package owns deterministic interpretation and request construction.

**Tech Stack:** TypeScript, Node test runner, Viem, `@morpho-org/blue-sdk` 6.11.0, `@morpho-org/blue-sdk-viem` 5.7.0, `@morpho-org/morpho-ts` 2.15.0, Next.js 14, Vite/Vitest 5/2.

**Spec:** `docs/superpowers/specs/2026-09-21-protocol-package-design.md`

## Global Constraints

- Ethereum Sepolia remains the only configured network; do not register global custom Morpho addresses.
- Normalize every contract and wallet address with `viem.getAddress()` before SDK, relayer, or protocol use.
- Use official Morpho SDK entities, math, and standard ABIs instead of copied implementations.
- Do not adopt the high-level `@morpho-org/morpho-sdk` transaction router.
- Do not change deployed contracts, addresses, wallet providers, signing, submission, keeper custody, or UI flows.
- `parseAmount(input, decimals)` trims surrounding whitespace, accepts correctly grouped commas, accepts a trailing decimal point, accepts zero, never rounds, and reports excess precision.
- Positivity remains an action invariant separate from parsing.
- Preserve the existing dirty worktree files: `.codacy/codacy.config.baseline.json`, `.codacy/codacy.config.json`, `packages/morpho-lab/src/config.ts`, `packages/morpho-lab/pnpm-lock.yaml`, and `packages/morpho-lab/pnpm-workspace.yaml`.
- Update generated dependency locks only as required for the new official SDK dependencies; do not include unrelated lockfile churn.
- Keep the Hardhat deployment script's Ethers ABI strings local in this plan: the shared package intentionally exports ESM TypeScript source while the current Hardhat script runs through a CommonJS-oriented ts-node boundary. The design explicitly permits this deferral until that runtime has a separate compatibility proof.

## Review Focus

- Extremely large or unsafe `decimals` values must fail before exponentiation or allocation; Task 1 adds this test.
- Misplaced commas and whitespace inside a number must be rejected while `1,000.` remains valid; Task 1 adds this table.
- Named and positional tuples with missing fields, unsafe numeric coercions, or invalid addresses must fail visibly; Task 2 adds these cases.
- SDK accrual must use the rate already read from the configured Sepolia IRM and never invoke unsupported-IRM registry behavior; Task 3 and Task 5 pin this path.
- Stored-yield fallback must use the same requested block as the failed projected read and must never mix latest-state data; Task 5 asserts every request.

---

### Task 1: Create The Workspace Package And Canonical Amount Parser

**Files:**
- Create: `packages/protocol/package.json`
- Create: `packages/protocol/tsconfig.json`
- Create: `packages/protocol/src/amounts.ts`
- Create: `packages/protocol/src/index.ts`
- Create: `packages/protocol/test/amounts.test.mjs`
- Modify: `package-lock.json`
- Modify: `packages/web/package.json`
- Modify: `packages/web/next.config.js`
- Modify: `packages/web/src/lib/format.ts`
- Modify: `packages/web/src/app/savings/page.tsx`
- Modify: `packages/morpho-lab/package.json`
- Modify: `packages/morpho-lab/src/protocol/actions.ts`
- Modify: `packages/morpho-lab/src/protocol/actions.test.ts`

**Interfaces:**
- Consumes: no earlier task interfaces.
- Produces: `parseAmount(input: string, decimals: number): bigint` from `@sortecerta/protocol`.

- [ ] **Step 1: Add package scaffolding and the failing amount tests**

Create `packages/protocol/package.json` with this public source export and test command:

```json
{
  "name": "@sortecerta/protocol",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "node --experimental-strip-types --test test/*.test.mjs",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@morpho-org/blue-sdk": "6.11.0",
    "@morpho-org/blue-sdk-viem": "5.7.0",
    "@morpho-org/morpho-ts": "2.15.0",
    "viem": "2.55.19"
  },
  "devDependencies": {
    "typescript": "^5.6.2"
  }
}
```

Create `packages/protocol/tsconfig.json` with ES2022, strict mode, bundler module resolution, `noEmit: true`, and `include: ["src"]`, matching the web/lab compiler assumptions.

Create `packages/protocol/test/amounts.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { parseAmount } from "../src/amounts.ts";

test("parses canonical non-negative token amounts", () => {
  assert.equal(parseAmount("0", 6), 0n);
  assert.equal(parseAmount(" 1 ", 6), 1_000_000n);
  assert.equal(parseAmount("1.", 6), 1_000_000n);
  assert.equal(parseAmount("1.000001", 6), 1_000_001n);
  assert.equal(parseAmount("1,000.25", 6), 1_000_250_000n);
  assert.equal(parseAmount("1,000.", 6), 1_000_000_000n);
});

test("rejects invalid syntax and misplaced grouping", () => {
  for (const value of ["", ".5", "-1", "+1", "1e3", "1,2", "12,34", "1,,000", "1 000", "1.2.3"]) {
    assert.throws(() => parseAmount(value, 6), /valid amount/i);
  }
});

test("reports precision and validates decimals before arithmetic", () => {
  assert.throws(() => parseAmount("1.0000001", 6), /at most 6 decimal places/i);
  for (const decimals of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, Infinity]) {
    assert.throws(() => parseAmount("1", decimals), /non-negative safe integer/i);
  }
});

test("rejects hostile long input without coercing a partial value", () => {
  assert.throws(() => parseAmount(`${"1".repeat(100_000)}x`, 6), /valid amount/i);
});
```

- [ ] **Step 2: Install only required workspace dependencies**

Run:

```bash
npm install --workspace @sortecerta/protocol --save-exact @morpho-org/blue-sdk@6.11.0 @morpho-org/blue-sdk-viem@5.7.0 @morpho-org/morpho-ts@2.15.0 viem@2.55.19
npm install --workspace @sortecerta/web @sortecerta/protocol@0.1.0
npm install --workspace @sortecerta/morpho-lab @sortecerta/protocol@0.1.0
```

Expected: `packages/protocol/package.json`, the two consumer manifests, and root `package-lock.json` contain only the new workspace/dependency entries; the preserved package-local pnpm files are unchanged.

- [ ] **Step 3: Run the amount test to verify RED**

Run: `npm run test -w @sortecerta/protocol`

Expected: FAIL because `packages/protocol/src/amounts.ts` does not exist.

- [ ] **Step 4: Implement exact parsing**

Create `packages/protocol/src/amounts.ts`:

```ts
export function parseAmount(input: string, decimals: number): bigint {
  if (!Number.isSafeInteger(decimals) || decimals < 0) {
    throw new Error("Decimals must be a non-negative safe integer.");
  }
  const value = input.trim();
  const match = /^(\d+|\d{1,3}(?:,\d{3})+)(?:\.(\d*))?$/.exec(value);
  if (!match) throw new Error("Enter a valid amount.");
  const fraction = match[2] ?? "";
  if (fraction.length > decimals) {
    throw new Error(`Enter an amount with at most ${decimals} decimal places.`);
  }
  const whole = match[1].replaceAll(",", "");
  const scale = 10n ** BigInt(decimals);
  const fractional = fraction.length === 0
    ? 0n
    : BigInt(fraction.padEnd(decimals, "0"));
  return BigInt(whole) * scale + fractional;
}
```

Export it from `packages/protocol/src/index.ts`.

- [ ] **Step 5: Run the package tests and typecheck to verify GREEN**

Run: `npm run test -w @sortecerta/protocol && npm run typecheck -w @sortecerta/protocol`

Expected: PASS.

- [ ] **Step 6: Migrate both consumers to the canonical parser**

Remove `parseUSDC` from `packages/web/src/lib/format.ts`; import `parseAmount` from `@sortecerta/protocol` in the savings page and replace `parseUSDC(value)` with `parseAmount(value, 6)`.

Remove the local parser helpers `parseAmount`, `isDecimalAmount`, and `hasOnlyDigits` from lab `actions.ts`, and re-export the shared function to preserve existing component and test imports:

```ts
export { parseAmount } from "@sortecerta/protocol";
```

Remove the zero expectation from parser tests; retain zero rejection in action validation tests. Add `@sortecerta/protocol` to `transpilePackages` in `packages/web/next.config.js`.

- [ ] **Step 7: Verify both consumer parser paths**

Run:

```bash
node --experimental-strip-types --test packages/web/tests/format.test.mjs
npm run test -w @sortecerta/morpho-lab -- --run src/protocol/actions.test.ts
```

Expected: PASS, including parser acceptance of zero and action-level rejection of zero-value writes.

- [ ] **Step 8: Commit**

```bash
git add package-lock.json packages/protocol packages/web/package.json packages/web/next.config.js packages/web/src/lib/format.ts packages/web/src/app/savings/page.tsx packages/morpho-lab/package.json packages/morpho-lab/src/protocol/actions.ts packages/morpho-lab/src/protocol/actions.test.ts
git commit -m "refactor(protocol): unify amount parsing"
```

### Task 2: Add SDK-Backed Market Parameter Decoding And Identity

**Files:**
- Create: `packages/protocol/src/decoders.ts`
- Create: `packages/protocol/src/market-params.ts`
- Create: `packages/protocol/test/market-params.test.mjs`
- Modify: `packages/protocol/src/index.ts`

**Interfaces:**
- Consumes: the protocol package created in Task 1.
- Produces: `toMarketParams(params: IMarketParams): MarketParams`, `decodeMarketParams(value: unknown): MarketParams`, `sameMarketParams(left: IMarketParams, right: IMarketParams): boolean`, `tupleValues(value, names)`, and `asBigInt(value, label)`.

- [ ] **Step 1: Write failing parameter and decoder tests**

Create tests that assert positional and named tuples normalize lowercase addresses to checksums, equivalent address casing yields identical official `MarketParams.id`, and a changed LLTV yields a different ID:

```js
const positional = [loan.toLowerCase(), collateral.toLowerCase(), oracle.toLowerCase(), irm.toLowerCase(), 945000000000000000n];
const named = { loanToken: loan, collateralToken: collateral, oracle, irm, lltv: 945000000000000000n };
assert.equal(decodeMarketParams(positional).id, decodeMarketParams(named).id);
assert.equal(sameMarketParams(decodeMarketParams(positional), decodeMarketParams(named)), true);
assert.equal(sameMarketParams(decodeMarketParams(positional), { ...named, lltv: 1n }), false);
```

Also assert rejection of a missing named field, a four-element tuple, an invalid address, a negative LLTV, an unsafe numeric LLTV, and a non-decimal string.

- [ ] **Step 2: Run parameter tests to verify RED**

Run: `npm run test -w @sortecerta/protocol`

Expected: FAIL because the exports do not exist.

- [ ] **Step 3: Implement strict shared decoders and canonical identity**

Use `tupleValues` to require exactly the requested fields for arrays or own named properties. Implement `asBigInt` to accept non-negative bigint, safe non-negative integer numbers, and canonical unsigned decimal strings only. Implement market conversion as:

```ts
import { MarketParams, type IMarketParams } from "@morpho-org/blue-sdk";
import { getAddress, type Address } from "viem";

export function toMarketParams(params: IMarketParams): MarketParams {
  return new MarketParams({
    loanToken: getAddress(params.loanToken as Address),
    collateralToken: getAddress(params.collateralToken as Address),
    oracle: getAddress(params.oracle as Address),
    irm: getAddress(params.irm as Address),
    lltv: asBigInt(params.lltv, "market LLTV"),
  });
}

export function sameMarketParams(left: IMarketParams, right: IMarketParams): boolean {
  return toMarketParams(left).id === toMarketParams(right).id;
}
```

`decodeMarketParams` must call `tupleValues` with `loanToken`, `collateralToken`, `oracle`, `irm`, and `lltv`, then call `toMarketParams`.

- [ ] **Step 4: Export and verify**

Run: `npm run test -w @sortecerta/protocol && npm run typecheck -w @sortecerta/protocol`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/protocol/src packages/protocol/test/market-params.test.mjs
git commit -m "refactor(protocol): centralize market identity"
```

### Task 3: Replace Copied Morpho Arithmetic With SDK Primitives

**Files:**
- Create: `packages/protocol/src/market-state.ts`
- Create: `packages/protocol/src/morpho-math.ts`
- Create: `packages/protocol/test/morpho-math.test.mjs`
- Modify: `packages/protocol/src/index.ts`

**Interfaces:**
- Consumes: `asBigInt` and `tupleValues` from Task 2.
- Produces: `MarketState`, `Position`, `PositionHealth`, `decodeMarketState`, `decodePosition`, `accruedMarketState`, `accruedBorrowAssets`, `toSupplyAssetsDown`, `toBorrowAssetsUp`, `utilizationWad`, `positionHealth`, `safeBorrowCapacity`, and `WAD`.

- [ ] **Step 1: Copy existing math fixtures into failing protocol tests**

Move the fixture expectations from `packages/morpho-lab/src/protocol/math.test.ts` into the new package test. Include explicit cases for:

```js
assert.throws(() => accruedMarketState(state, 1n, state.lastUpdate - 1n), /timestamp/i);
assert.throws(() => accruedMarketState({ ...state, totalBorrowAssets: 1n }, undefined, state.lastUpdate + 1n), /rate unavailable/i);
assert.deepEqual(accruedMarketState({ ...state, totalBorrowAssets: 0n }, undefined, state.lastUpdate + 1n), { ...state, totalBorrowAssets: 0n });
```

Retain exact expected rounding for supply assets, borrow assets, fee shares, utilization, health, and safe capacity.

- [ ] **Step 2: Run math tests to verify RED**

Run: `npm run test -w @sortecerta/protocol`

Expected: FAIL because `morpho-math.ts` does not exist.

- [ ] **Step 3: Implement SDK-backed state and math wrappers**

Define `MarketState` as the six state fields from the SDK `IMarket`, and decode named/positional tuples through Task 2 helpers. Define `Position` with `supplyShares`, `borrowShares`, and the existing `collateralAssets` compatibility name.

Use official primitives in every Morpho calculation:

```ts
import { MarketUtils, MathLib } from "@morpho-org/blue-sdk";

export const WAD = MathLib.WAD;

export function accruedMarketState(state: MarketState, rate: bigint | undefined, timestamp: bigint): MarketState {
  if (timestamp < state.lastUpdate) throw new Error("Invalid accrual timestamp.");
  if (timestamp === state.lastUpdate || state.totalBorrowAssets === 0n) return state;
  if (rate === undefined) throw new Error("Borrow rate unavailable. Refresh before continuing.");
  const { interest, feeShares } = MarketUtils.getAccruedInterest(rate, state, timestamp - state.lastUpdate);
  return {
    ...state,
    totalBorrowAssets: state.totalBorrowAssets + interest,
    totalSupplyAssets: state.totalSupplyAssets + interest,
    totalSupplyShares: state.totalSupplyShares + feeShares,
    lastUpdate: timestamp,
  };
}

export const toSupplyAssetsDown = (shares: bigint, totalSupplyAssets: bigint, totalSupplyShares: bigint) =>
  MarketUtils.toSupplyAssets(shares, { totalSupplyAssets, totalSupplyShares }, "Down");

export const toBorrowAssetsUp = (shares: bigint, totalBorrowAssets: bigint, totalBorrowShares: bigint) =>
  MarketUtils.toBorrowAssets(shares, { totalBorrowAssets, totalBorrowShares }, "Up");
```

Use `MathLib.wTaylorCompounded` plus `MathLib.wMulDown` for `accruedBorrowAssets`, `MarketUtils.getUtilization` for utilization, and `MarketUtils.getCollateralValue`/`getMaxBorrowAssets` for health. Do not construct `Market` or call `Market.accrueInterest`, because that path consults SDK IRM support instead of using the explicitly read Sepolia rate.

- [ ] **Step 4: Run protocol math verification**

Run: `npm run test -w @sortecerta/protocol && npm run typecheck -w @sortecerta/protocol`

Expected: PASS with the same integer outputs as the pre-refactor fixtures.

- [ ] **Step 5: Commit**

```bash
git add packages/protocol/src packages/protocol/test/morpho-math.test.mjs
git commit -m "refactor(protocol): use Morpho SDK math"
```

### Task 4: Centralize ABIs And Shared Request Builders

**Files:**
- Create: `packages/protocol/src/abis/index.ts`
- Create: `packages/protocol/src/abis/confidential-prize-pool.ts`
- Create: `packages/protocol/src/abis/confidential-usdc.ts`
- Create: `packages/protocol/src/abis/morpho-yield-adapter.ts`
- Create: `packages/protocol/src/abis/tokens.ts`
- Create: `packages/protocol/src/transaction-builders.ts`
- Create: `packages/protocol/test/abis.test.mjs`
- Create: `packages/protocol/test/transaction-builders.test.mjs`
- Modify: `packages/protocol/src/index.ts`

**Interfaces:**
- Consumes: official `blueAbi`, `adaptiveCurveIrmAbi`, and `blueOracleAbi` from `@morpho-org/blue-sdk-viem`.
- Produces: `morphoBlueAbi`, `morphoIrmAbi`, `morphoOracleAbi`, `confidentialPrizePoolAbi`, `confidentialUsdcAbi`, `morphoYieldAdapterAbi`, `erc20Abi`, `wethAbi`, `unwrapRequestedEvent`, `unwrapFinalizedEvent`, `buildCloseDrawRequest`, and `buildFinalizeUnwrapRequest`.

- [ ] **Step 1: Write failing ABI surface tests**

Create a helper that asserts an ABI contains a named item and test every consumed surface:

```js
function has(abi, type, name) {
  return abi.some((item) => item.type === type && item.name === name);
}

assert.equal(has(morphoBlueAbi, "function", "market"), true);
assert.equal(has(morphoBlueAbi, "function", "position"), true);
assert.equal(has(morphoBlueAbi, "function", "idToMarketParams"), true);
assert.equal(has(morphoBlueAbi, "function", "accrueInterest"), true);
assert.equal(has(morphoIrmAbi, "function", "borrowRateView"), true);
assert.equal(has(morphoOracleAbi, "function", "price"), true);
```

For the pool, assert every function currently referenced by `packages/web/src`, both Netlify keeper functions, and lab `read.ts`, including draw, yield, withdrawal batch, encrypted handle, settlement, claim, and Morpho supply/unwrap functions. Assert adapter bindings/state functions and wrapper finalize/unwrap events.

Create failing builder tests with lowercase input addresses and exact requests:

```js
assert.deepEqual(buildCloseDrawRequest(pool.toLowerCase()), {
  address: getAddress(pool),
  abi: confidentialPrizePoolAbi,
  functionName: "closeDraw",
  args: [],
});
assert.deepEqual(buildFinalizeUnwrapRequest(wrapper.toLowerCase(), requestId, 7n, proof), {
  address: getAddress(wrapper),
  abi: confidentialUsdcAbi,
  functionName: "finalizeUnwrap",
  args: [requestId, 7n, proof],
});
```

- [ ] **Step 2: Run ABI tests to verify RED**

Run: `npm run test -w @sortecerta/protocol`

Expected: FAIL because the ABI modules do not exist.

- [ ] **Step 3: Export official standard ABIs and consolidate custom ABIs**

Alias official exports without copying:

```ts
export {
  blueAbi as morphoBlueAbi,
  adaptiveCurveIrmAbi as morphoIrmAbi,
  blueOracleAbi as morphoOracleAbi,
} from "@morpho-org/blue-sdk-viem";
```

Move the union of actively consumed `ConfidentialPrizePool`, `ConfidentialUSDC`, and `MorphoYieldAdapter` entries from web, lab, and keepers into the three custom ABI files. Keep the ABI objects `as const`; export event items from those same sources instead of parsing duplicate event strings. Re-export Viem's built-in `erc20Abi` so reads and `approve` share one standard definition, and retain a small WETH ABI for `deposit`/`withdraw`.

Implement only the two request shapes proven identical across consumers:

```ts
export function buildCloseDrawRequest(pool: Address) {
  return { address: getAddress(pool), abi: confidentialPrizePoolAbi, functionName: "closeDraw", args: [] } as const;
}

export function buildFinalizeUnwrapRequest(wrapper: Address, requestId: Hex, amount: bigint, proof: Hex) {
  return {
    address: getAddress(wrapper),
    abi: confidentialUsdcAbi,
    functionName: "finalizeUnwrap",
    args: [requestId, amount, proof],
  } as const;
}
```

- [ ] **Step 4: Verify ABI coverage and types**

Run: `npm run test -w @sortecerta/protocol && npm run typecheck -w @sortecerta/protocol`

Expected: PASS; no custom ABI consumer named in the test is missing.

- [ ] **Step 5: Commit**

```bash
git add packages/protocol/src packages/protocol/test/abis.test.mjs packages/protocol/test/transaction-builders.test.mjs
git commit -m "refactor(protocol): centralize contract calls"
```

### Task 5: Move Morpho Yield Projection And Pinned Reads

**Files:**
- Create: `packages/protocol/src/morpho-yield.ts`
- Create: `packages/protocol/test/morpho-yield.test.mjs`
- Modify: `packages/protocol/src/index.ts`
- Modify: `packages/web/src/lib/morpho-yield.ts`
- Modify: `packages/web/tests/morpho-yield.test.mjs`

**Interfaces:**
- Consumes: Task 2 decoders, Task 3 SDK math, and Task 4 ABIs.
- Produces: `projectMorphoYield(input: ProjectionInput): bigint`, `readProjectedMorphoYield(client, pool, blockNumber): Promise<ProjectedMorphoYield>`, and `ProjectedMorphoYield`.

- [ ] **Step 1: Add failing package-level projection and block tests**

Move the projection fixture and `projectionClient` helper from the web test into the protocol test. Keep assertions for exact compounded interest, fee shares, virtual liquidity, zero floor, successful projection, stored fallback, and no fallback on success.

Add this fallback pin assertion:

```js
const result = await readProjectedMorphoYield(client, addresses.pool, 77n);
assert.equal(result.source, "stored");
assert.ok(client.requests.every((request) => request.blockNumber === 77n));
assert.deepEqual(client.blockRequests, [{ blockNumber: 77n }]);
```

- [ ] **Step 2: Run projection tests to verify RED**

Run: `npm run test -w @sortecerta/protocol`

Expected: FAIL because `morpho-yield.ts` does not exist.

- [ ] **Step 3: Move projection code and replace local formulas**

Move `ProjectionInput`, `ProjectedMorphoYield`, `projectMorphoYield`, `readProjectedMorphoYield`, and the private pinned `read` helper from web to the protocol package. Replace local ABI arrays, tuple parsing, accrual, and share conversion with Tasks 2–4 exports.

Retain the explicit-rate flow:

```ts
const accrued = accruedMarketState(market, borrowRatePerSecond, blockTimestamp);
const suppliedAssets = idlePrincipal + toSupplyAssetsDown(
  supplyShares,
  accrued.totalSupplyAssets,
  accrued.totalSupplyShares,
);
return suppliedAssets > suppliedPrincipal ? suppliedAssets - suppliedPrincipal : 0n;
```

Every projected and fallback read must receive the function's `blockNumber` argument.

- [ ] **Step 4: Leave only refresh orchestration in web**

Keep `createLatestBlockRefresher` and its `BlockSnapshot` type in `packages/web/src/lib/morpho-yield.ts`. Import and re-export the protocol yield functions/types so existing web call sites remain stable:

```ts
export {
  projectMorphoYield,
  readProjectedMorphoYield,
  type ProjectedMorphoYield,
} from "@sortecerta/protocol";
```

Remove the duplicated market types, ABIs, math, and decoders from the web file.

- [ ] **Step 5: Verify protocol and web yield behavior**

Run:

```bash
npm run test -w @sortecerta/protocol
node --experimental-strip-types --test packages/web/tests/morpho-yield.test.mjs
npm run typecheck -w @sortecerta/web
```

Expected: PASS, including overlapping refresh ordering and same-block fallback.

- [ ] **Step 6: Commit**

```bash
git add packages/protocol packages/web/src/lib/morpho-yield.ts packages/web/tests/morpho-yield.test.mjs
git commit -m "refactor(protocol): share pinned yield reads"
```

### Task 6: Move The Lab Protocol Snapshot Behind An Explicit Block

**Files:**
- Create: `packages/protocol/src/snapshot-types.ts`
- Create: `packages/protocol/src/protocol-read.ts`
- Modify: `packages/protocol/src/index.ts`
- Modify: `packages/morpho-lab/src/types.ts`
- Modify: `packages/morpho-lab/src/protocol/read.ts`
- Modify: `packages/morpho-lab/src/protocol/read.test.ts`

**Interfaces:**
- Consumes: Tasks 2–4 decoders, math, market identity, and ABIs.
- Produces: `ProtocolDeploymentConfig`, `ProtocolReadClient`, `ProtocolSnapshotData`, snapshot component types, and `readProtocolSnapshotAtBlock(client, config, blockNumber, account?)`.

- [ ] **Step 1: Add an explicit-block characterization test**

In the existing lab read test, import `readProtocolSnapshotAtBlock` from `@sortecerta/protocol` and add a test using the existing `createClient` fixture:

```ts
const snapshot = await readProtocolSnapshotAtBlock(client, config, 456n, account);
expect(snapshot.blockNumber).toBe(456n);
expect(client.calls.every((call) => call.blockNumber === 456n)).toBe(true);
```

Adjust `createClient` so `getBlock` and `getBalance` assert the block supplied by the caller rather than hard-coding `123n`.

- [ ] **Step 2: Run the explicit-block test to verify RED**

Run: `npm run test -w @sortecerta/morpho-lab -- --run src/protocol/read.test.ts`

Expected: FAIL because `readProtocolSnapshotAtBlock` is not exported.

- [ ] **Step 3: Move snapshot data types into the protocol package**

Move the protocol-domain types from lab `types.ts` to `snapshot-types.ts`. Rename the top-level shared shape to:

```ts
export type ProtocolDeploymentConfig = {
  usdc: Address;
  weth: Address;
  wrapper: Address;
  pool: Address;
  adapter: Address;
  morpho: Address;
  marketId: Hex;
};

export type ProtocolSnapshotData = {
  blockNumber: bigint;
  blockTimestamp: bigint;
  deployment: DeploymentSnapshot;
  pool: PoolSnapshot;
  adapter: AdapterSnapshot;
  market: MorphoMarketSnapshot;
  account?: AccountSnapshot;
};
```

Keep `refreshedAt` out of the shared type. In lab `types.ts`, re-export the component types and define:

```ts
import type { ProtocolSnapshotData } from "@sortecerta/protocol";
export type ProtocolSnapshot = ProtocolSnapshotData & { refreshedAt: number };
```

- [ ] **Step 4: Move the deterministic reader and make the block explicit**

Move the body of lab `readProtocolSnapshot` to `packages/protocol/src/protocol-read.ts`. Replace lab imports with Tasks 2–4 modules. Change its interface to:

```ts
export type ProtocolReadClient = {
  getBlock(request: { blockNumber: bigint }): Promise<{ timestamp: bigint }>;
  getBalance(request: { address: Address; blockNumber?: bigint }): Promise<bigint>;
  readContract(request: {
    address: Address;
    abi: readonly unknown[];
    functionName: string;
    args?: readonly unknown[];
    blockNumber?: bigint;
  }): Promise<unknown>;
};

export async function readProtocolSnapshotAtBlock(
  client: ProtocolReadClient,
  config: ProtocolDeploymentConfig,
  blockNumber: bigint,
  account?: Address,
): Promise<ProtocolSnapshotData>;
```

Remove `getBlockNumber()` and `Date.now()` from the shared implementation. Replace local `parseMarketParams`, `parseMarketState`, `parsePosition`, `sameMarketParams`, `tupleValues`, and `asBigInt` with package helpers. Use official ABIs from Task 4.

- [ ] **Step 5: Keep latest-block selection and refresh time in the lab wrapper**

Reduce lab `protocol/read.ts` to:

```ts
import { readProtocolSnapshotAtBlock, type ProtocolReadClient as SharedReadClient } from "@sortecerta/protocol";
import type { Address } from "viem";
import type { LabConfig } from "../config";
import type { ProtocolSnapshot } from "../types";

export type ProtocolReadClient = SharedReadClient & { getBlockNumber(): Promise<bigint> };

export async function readProtocolSnapshot(client: ProtocolReadClient, config: LabConfig, account?: Address): Promise<ProtocolSnapshot> {
  const blockNumber = await client.getBlockNumber();
  const snapshot = await readProtocolSnapshotAtBlock(client, config, blockNumber, account);
  return { ...snapshot, refreshedAt: Date.now() };
}
```

- [ ] **Step 6: Verify the complete lab reader**

Run:

```bash
npm run test -w @sortecerta/protocol
npm run test -w @sortecerta/morpho-lab -- --run src/protocol/read.test.ts
npm run typecheck -w @sortecerta/morpho-lab
```

Expected: PASS; every read in both the latest wrapper and explicit-block test is pinned.

- [ ] **Step 7: Commit**

```bash
git add packages/protocol packages/morpho-lab/src/types.ts packages/morpho-lab/src/protocol/read.ts packages/morpho-lab/src/protocol/read.test.ts
git commit -m "refactor(protocol): share pinned snapshots"
```

### Task 7: Migrate Lab Actions And Remove Local Morpho Duplicates

**Files:**
- Modify: `packages/morpho-lab/src/protocol/actions.ts`
- Modify: `packages/morpho-lab/src/protocol/actions.test.ts`
- Modify: `packages/morpho-lab/src/protocol/prize-funding.ts`
- Modify: `packages/morpho-lab/src/protocol/prize-funding.test.ts`
- Modify: `packages/morpho-lab/src/protocol/operator-actions.ts`
- Modify: `packages/morpho-lab/src/App.tsx`
- Modify: `packages/morpho-lab/src/components/AccountPanel.tsx`
- Modify: `packages/morpho-lab/src/components/AdapterPanel.tsx`
- Modify: `packages/morpho-lab/src/components/DeploymentPanel.tsx`
- Modify: `packages/morpho-lab/src/components/MarketPanel.tsx`
- Modify: `packages/morpho-lab/src/components/OperatorPanel.tsx`
- Modify: `packages/morpho-lab/src/components/PoolPanel.tsx`
- Modify: `packages/morpho-lab/src/components/Workbench.tsx`
- Delete: `packages/morpho-lab/src/protocol/math.ts`
- Delete: `packages/morpho-lab/src/protocol/math.test.ts`
- Delete: `packages/morpho-lab/src/abis.ts`

**Interfaces:**
- Consumes: all shared types, SDK math, market identity, amount parser, and ABIs created in Tasks 1–6.
- Produces: unchanged lab action-builder and component behavior with no local Morpho math, type, decoder, comparison, or ABI implementation.

- [ ] **Step 1: Add regression assertions before changing imports**

Extend lab action tests to verify case-varied but equivalent market addresses pass `createActionContext`, while a changed LLTV still throws the binding error. Retain exact max-action, repay-all, safety-margin, and positive-amount tests.

- [ ] **Step 2: Run lab tests as the pre-migration baseline**

Run: `npm run test -w @sortecerta/morpho-lab -- --run`

Expected: PASS before structural edits.

- [ ] **Step 3: Replace lab-local imports**

Import SDK-backed helpers and types from `@sortecerta/protocol`. Replace action-local `normalizeParams`/`sameMarketParams` checks with `toMarketParams` and `sameMarketParams`. Import `morphoBlueAbi`, `erc20Abi`, and `wethAbi` from the package. Replace the operator's duplicated `closeDraw` request with `buildCloseDrawRequest`.

Keep the remaining lab action builders local because no second consumer constructs the same direct MetaMask workbench requests. Keep positivity validation local:

```ts
function positive(amount: bigint) {
  if (amount <= 0n) throw new Error("Enter a positive amount.");
}
```

- [ ] **Step 4: Remove obsolete local modules and update type-only component imports**

Delete `math.ts`, its migrated test, and `abis.ts` after `rg` shows no remaining imports. Change components and operator/prize modules to import snapshot types from `@sortecerta/protocol` or the lab compatibility type file as appropriate.

- [ ] **Step 5: Verify lab behavior and bundle**

Run:

```bash
npm run test -w @sortecerta/morpho-lab -- --run
npm run typecheck -w @sortecerta/morpho-lab
npm run build -w @sortecerta/morpho-lab
```

Expected: all tests pass and Vite builds with SDK code resolved from the workspace package.

- [ ] **Step 6: Commit**

```bash
git add packages/morpho-lab/src packages/protocol
git commit -m "refactor(morpho-lab): consume protocol package"
```

### Task 8: Migrate Web And Keeper Custom ABIs

**Files:**
- Modify: `packages/web/src/lib/contracts.ts`
- Modify: `packages/web/src/app/draw/page.tsx`
- Modify: `packages/web/src/app/savings/page.tsx`
- Modify: `packages/web/src/lib/confidential-balances.ts`
- Modify: `packages/web/src/lib/web3auth.ts`
- Modify: `packages/web/netlify/functions/morpho-keeper.ts`
- Modify: `packages/web/netlify/functions/withdrawal-keeper.ts`
- Modify: `packages/web/tests/morpho-keeper.test.mjs`
- Modify: `packages/web/tests/withdrawal-keeper.test.mjs`
- Modify: `packages/web/tests/withdrawal-delivery.test.mjs`

**Interfaces:**
- Consumes: custom and official ABIs plus request builders from Task 4 and `decodeMarketParams` from Task 2.
- Produces: unchanged frontend and keeper contract calls with no duplicated active SorteCerta or Morpho ABI definitions.

- [ ] **Step 1: Add keeper ABI regression assertions**

Extend keeper tests to execute the `accrue`, `supply`, `finalize`, withdrawal `close`, `settle`, `processWithdrawal`, and delivery paths with existing fake clients. Assert the emitted request's `functionName` and arguments remain unchanged, especially the checksummed decoded `marketParams` object passed to `accrueInterest`.

- [ ] **Step 2: Run keeper tests as the pre-migration baseline**

Run:

```bash
node --experimental-strip-types --test packages/web/tests/morpho-keeper.test.mjs packages/web/tests/withdrawal-keeper.test.mjs packages/web/tests/withdrawal-delivery.test.mjs
```

Expected: PASS before structural edits.

- [ ] **Step 3: Replace web ABI definitions with protocol exports**

Remove active `confidentialUsdcAbi` and `confidentialPrizePoolAbi` arrays from `contracts.ts` and re-export them:

```ts
export { confidentialPrizePoolAbi, confidentialUsdcAbi } from "@sortecerta/protocol";
```

Leave the unrelated Zama spike and plaintext prototype ABIs in place. Existing source imports may continue through the `contracts.ts` compatibility re-export; no compatibility export may contain a copied ABI.

- [ ] **Step 4: Replace keeper-local parsed ABIs and tuple reconstruction**

Delete local `parseAbi` and `parseAbiItem` declarations from both Netlify functions. Import pool, wrapper, adapter, Morpho, and event ABIs from `@sortecerta/protocol`. Replace manual positional market parameter reconstruction with:

```ts
const params = decodeMarketParams(marketParams);
args: [{
  loanToken: params.loanToken,
  collateralToken: params.collateralToken,
  oracle: params.oracle,
  irm: params.irm,
  lltv: params.lltv,
}]
```

Keep environment access, keys, scheduling, decryption, wallet clients, transaction submission, and receipt handling local.

Replace duplicated `closeDraw` and `finalizeUnwrap` request objects in Web3Auth, the savings page, and both keepers with `buildCloseDrawRequest` or `buildFinalizeUnwrapRequest`. Consumers add their own `account` and `chain` fields when submitting a returned request.

- [ ] **Step 5: Verify web, keepers, and production compilation**

Run:

```bash
node --experimental-strip-types --test packages/web/tests/*.test.mjs packages/web/test/*.test.mjs
npm run typecheck -w @sortecerta/web
npm run build -w @sortecerta/web
npm run test -w @sortecerta/keeper
```

Expected: PASS; Next.js compiles the workspace source package and keeper requests are unchanged.

- [ ] **Step 6: Commit**

```bash
git add packages/web packages/protocol
git commit -m "refactor(web): consume shared protocol ABIs"
```

### Task 9: Duplication Audit And Full Verification

**Files:**
- Modify only files required to fix a failing verification directly caused by Tasks 1–8.

**Interfaces:**
- Consumes: the complete migrated package and consumers.
- Produces: verified absence of targeted duplicates and a branch ready for final review.

- [ ] **Step 1: Prove the targeted duplicates are gone**

Run:

```bash
rg -n "function sameMarketParams|function parseMarketParams|function parseUSDC|const marketParamsComponents|const morphoAbi = parseAbi|const morphoReadAbi|function accruedBorrowAssets|function toSupplyAssetsDown" packages/web packages/morpho-lab packages/keeper --glob '!**/*lock*'
```

Expected: no matches outside compatibility imports/re-exports; implementations exist only in `packages/protocol` or the official SDK.

- [ ] **Step 2: Check the diff and preserved worktree files**

Run:

```bash
git diff --check
git status --short
git diff -- .codacy/codacy.config.baseline.json .codacy/codacy.config.json packages/morpho-lab/src/config.ts
```

Expected: no whitespace errors; the three tracked pre-existing changes are not staged or altered by this plan; the two untracked Morpho-lab pnpm files remain untracked.

- [ ] **Step 3: Run the complete verification matrix**

Run:

```bash
npm run test -w @sortecerta/protocol
npm run typecheck -w @sortecerta/protocol
npm run test -w @sortecerta/morpho-lab -- --run
npm run typecheck -w @sortecerta/morpho-lab
npm run build -w @sortecerta/morpho-lab
node --experimental-strip-types --test packages/web/tests/*.test.mjs packages/web/test/*.test.mjs
npm run typecheck -w @sortecerta/web
npm run build -w @sortecerta/web
npm run test -w @sortecerta/keeper
```

Expected: every command exits zero.

- [ ] **Step 4: Run focused Codacy analysis**

Use the repository's Codacy Analysis CLI workflow against changed TypeScript/JavaScript files, excluding `package-lock.json` from issue triage as requested.

Expected: no new Critical or High issue remains in the changed source files. Lower severities are reported but not expanded into unrelated cleanup.

- [ ] **Step 5: Commit verification-only fixes if any**

If verification required source fixes, stage only those exact files and commit:

```bash
git commit -m "fix(protocol): satisfy integration gates"
```

If no files changed, do not create an empty commit.

- [ ] **Step 6: Final branch review, push, and handoff**

Run the execution workflow's required whole-branch reviewer against the approved spec and this plan. Fix Critical and Important findings with failing tests first, record any rulings/deferred minors, rerun the complete matrix, then push `codex/morpho-lab` to its configured remote.

Expected: final review has no unresolved Critical or Important finding, verification remains green, and the remote branch contains all protocol-package commits.
