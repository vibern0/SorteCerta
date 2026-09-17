# Local Morpho Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local MetaMask-only Morpho playground with complete protocol telemetry and safe Sepolia lending, collateral, borrowing, repayment, and round-closing controls, then remove the consumer app's `/admin` surface.

**Architecture:** Add an isolated Vite application in `packages/morpho-lab` that reads a fixed current deployment with `viem`, keeps Morpho arithmetic in tested pure functions, and sends simulated writes through MetaMask's EIP-1193 provider. The existing Next.js application remains independent and loses its admin route and navigation item; no lab code or link enters the consumer bundle.

**Tech Stack:** React 18, TypeScript 5.6, Vite, Vitest, viem, MetaMask EIP-1193, plain CSS

**Spec:** `docs/superpowers/specs/2026-09-17-morpho-lab-design.md`

## Global Constraints

- The lab runs locally on `localhost:3001` and is never linked or deployed with the consumer application.
- MetaMask is the only wallet provider; no Web3Auth, smart account, paymaster, private key, or stored credential enters the lab.
- Writes are enabled only on chain ID `11155111` and must be simulated before MetaMask receives the request.
- The current deployment and USDC/WETH Morpho market are fixed defaults with optional local environment overrides; arbitrary address entry is out of scope.
- Every configured or wallet-provided address is normalized with `viem.getAddress()`.
- Approval transactions approve only the requested amount.
- Retired pools and adapters must never be read by default or targeted by a write.
- Encrypted aggregate and user values remain encrypted; the UI must not label handles as cleartext amounts.
- Every completed task is committed and pushed to `origin/main` before the next task starts.

---

## File Structure

### New Lab Package

- `packages/morpho-lab/package.json` - package scripts and isolated dependencies.
- `packages/morpho-lab/index.html` - Vite entry document.
- `packages/morpho-lab/tsconfig.json` - strict browser TypeScript configuration.
- `packages/morpho-lab/vite.config.ts` - port `3001` and Vitest configuration.
- `packages/morpho-lab/src/main.tsx` - React mount only.
- `packages/morpho-lab/src/App.tsx` - page composition and refresh orchestration.
- `packages/morpho-lab/src/styles.css` - dense responsive console styling.
- `packages/morpho-lab/src/config.ts` - defaults, environment overrides, and validation.
- `packages/morpho-lab/src/abis.ts` - minimal typed contract ABIs.
- `packages/morpho-lab/src/types.ts` - snapshots, transaction records, and shared domain types.
- `packages/morpho-lab/src/protocol/math.ts` - pure Morpho conversions, rates, health, and max amounts.
- `packages/morpho-lab/src/protocol/read.ts` - one coherent onchain snapshot reader.
- `packages/morpho-lab/src/protocol/actions.ts` - simulated write builders and receipts.
- `packages/morpho-lab/src/wallet/MetaMaskProvider.tsx` - EIP-1193 connection and chain state.
- `packages/morpho-lab/src/components/` - deployment, pool, adapter, market, account, transaction, workbench, and operator panels.
- `packages/morpho-lab/src/**/*.test.ts` - Vitest coverage for deterministic logic.

### Existing Consumer Package

- Delete `packages/web/src/app/admin/page.tsx`.
- Modify `packages/web/src/components/Header.tsx` to remove the admin navigation entry.
- Add `packages/web/tests/no-admin-route.test.mjs` to prevent the route or link from returning.
- Modify root `package.json` with lab commands.

---

### Task 1: Scaffold The Isolated Lab And Validate Configuration

**Files:**
- Create: `packages/morpho-lab/package.json`
- Create: `packages/morpho-lab/index.html`
- Create: `packages/morpho-lab/tsconfig.json`
- Create: `packages/morpho-lab/vite.config.ts`
- Create: `packages/morpho-lab/src/main.tsx`
- Create: `packages/morpho-lab/src/App.tsx`
- Create: `packages/morpho-lab/src/styles.css`
- Create: `packages/morpho-lab/src/config.ts`
- Create: `packages/morpho-lab/src/config.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `LabConfig`, `loadLabConfig(env)`, `validateLabConfig(config)`.
- Produces root commands: `lab:dev`, `lab:build`, `lab:typecheck`, `lab:test`.

- [ ] **Step 1: Write failing configuration tests**

```ts
it("loads checksummed current deployment defaults", () => {
  const config = loadLabConfig({});
  expect(config.chainId).toBe(11155111);
  expect(config.pool).toBe("0x3d974cEF83CaC5BfD970CA95E121774eb8C9f233");
  expect(config.adapter).toBe("0x84B120Db8b600DE01A49143cf515246B79afcfef");
});

it("rejects invalid address overrides", () => {
  expect(() => loadLabConfig({ VITE_MORPHO_ADDRESS: "bad" })).toThrow("Morpho address");
});
```

- [ ] **Step 2: Run the isolated tests and confirm the missing module failure**

Run: `npm run lab:test -- --run src/config.test.ts`

Expected: FAIL because the package and `loadLabConfig` do not exist.

- [ ] **Step 3: Add the workspace package and root scripts**

Use React 18 and the repository's `viem` version. Configure Vite with:

```ts
export default defineConfig({
  plugins: [react()],
  server: { port: 3001, strictPort: true },
  test: { environment: "node" },
});
```

Add root scripts that call the `@sortecerta/morpho-lab` workspace through npm.

- [ ] **Step 4: Implement checked defaults and strict overrides**

```ts
export type LabConfig = {
  chainId: 11155111;
  rpcUrl: string;
  usdc: Address;
  weth: Address;
  wrapper: Address;
  pool: Address;
  adapter: Address;
  morpho: Address;
  marketId: Hex;
};

export function loadLabConfig(env: Record<string, string | undefined>): LabConfig;
export function validateLabConfig(config: LabConfig): void;
```

Normalize all addresses by lowercasing untrusted environment text before `getAddress`, then retain the checksummed result. Reject a market ID that is not exactly 32 bytes.

- [ ] **Step 5: Add the minimal app shell and neutral technical styling**

Render a title, a configuration status, and placeholders for wallet, metrics, workbench, and activity. Use stable responsive grid tracks and no dependency on `packages/web` styles.

- [ ] **Step 6: Run package gates**

Run: `npm run lab:test -- --run`

Expected: configuration tests PASS.

Run: `npm run lab:typecheck && npm run lab:build`

Expected: both commands exit `0`.

- [ ] **Step 7: Commit and push**

```bash
git add package.json package-lock.json packages/morpho-lab
git commit -m "feat: scaffold local Morpho lab"
git push origin main
```

### Task 2: Implement Exact Morpho Math And Snapshot Reads

**Files:**
- Create: `packages/morpho-lab/src/abis.ts`
- Create: `packages/morpho-lab/src/types.ts`
- Create: `packages/morpho-lab/src/protocol/math.ts`
- Create: `packages/morpho-lab/src/protocol/math.test.ts`
- Create: `packages/morpho-lab/src/protocol/read.ts`
- Create: `packages/morpho-lab/src/protocol/read.test.ts`

**Interfaces:**
- Consumes: `LabConfig` from Task 1.
- Produces: `readProtocolSnapshot(client, config, account?): Promise<ProtocolSnapshot>`.
- Produces: `toSupplyAssetsDown`, `toBorrowAssetsUp`, `utilizationWad`, `supplyRatePerSecond`, `positionHealth`, and `safeBorrowCapacity`.

- [ ] **Step 1: Write failing math tests for Morpho virtual shares and rounding**

```ts
expect(toSupplyAssetsDown(56_891_532_399_737n, 185_634_262n, 185_606_640_011_820n))
  .toBe(56_899_998n);
expect(toBorrowAssetsUp(1n, 35_004_528n, 34_998_315_844_080n)).toBe(1n);
expect(utilizationWad(35_004_528n, 185_634_262n)).toBe(188_567_173_014_645_324n);
```

Implement supply conversion with `VIRTUAL_SHARES = 1_000_000` and `VIRTUAL_ASSETS = 1`; borrow conversion uses the Morpho Blue virtual borrow constants and rounds debt upward.

- [ ] **Step 2: Write failing collateral and safety tests**

```ts
const health = positionHealth({
  collateralAssets: 1_000_000_000_000_000_000n,
  collateralPrice: 2_000n * 10n ** 24n,
  borrowAssets: 1_000_000_000n,
  lltv: 945_000_000_000_000_000n,
});
expect(health.ltvWad).toBe(500_000_000_000_000_000n);
expect(health.liquidatable).toBe(false);
expect(safeBorrowCapacity(health, 900_000_000_000_000_000n)).toBe(800_000_000n);
```

Account for the loan and collateral token decimal relationship encoded in Morpho oracle prices rather than applying an additional display-decimal conversion.

- [ ] **Step 3: Run math tests and verify they fail**

Run: `npm run lab:test -- --run src/protocol/math.test.ts`

Expected: FAIL because the functions are missing.

- [ ] **Step 4: Implement pure math and formatting-safe domain types**

```ts
export type MarketState = {
  totalSupplyAssets: bigint;
  totalSupplyShares: bigint;
  totalBorrowAssets: bigint;
  totalBorrowShares: bigint;
  lastUpdate: bigint;
  fee: bigint;
};

export type PositionHealth = {
  collateralValue: bigint;
  borrowLimit: bigint;
  borrowAssets: bigint;
  ltvWad?: bigint;
  liquidatable: boolean;
};
```

Use integer arithmetic for balances and health limits. Convert per-second rates to display APY only at the final formatting boundary.

- [ ] **Step 5: Write a failing snapshot-reader test with a mocked public client**

Assert that one call returns deployment bindings, pool metrics, adapter metrics, market state, oracle price, IRM rate, token balances, allowances, and the optional account position. Assert it throws when adapter market parameters differ from configured values.

- [ ] **Step 6: Add minimal ABIs and implement `readProtocolSnapshot`**

Read independent calls concurrently. The snapshot must include:

```ts
export type ProtocolSnapshot = {
  blockNumber: bigint;
  refreshedAt: number;
  deployment: DeploymentSnapshot;
  pool: PoolSnapshot;
  adapter: AdapterSnapshot;
  market: MorphoMarketSnapshot;
  account?: AccountSnapshot;
};
```

Call the IRM's `borrowRateView` when available; catch only that call and return `undefined` for rates if unsupported. All other binding mismatches fail the refresh visibly.

- [ ] **Step 7: Run deterministic tests and gates**

Run: `npm run lab:test -- --run src/protocol/math.test.ts src/protocol/read.test.ts`

Expected: PASS.

Run: `npm run lab:typecheck && npm run lab:build`

Expected: PASS.

- [ ] **Step 8: Commit and push**

```bash
git add packages/morpho-lab/src
git commit -m "feat: read Morpho protocol state"
git push origin main
```

### Task 3: Add MetaMask State And Simulated Transaction Tracking

**Files:**
- Create: `packages/morpho-lab/src/wallet/eip1193.ts`
- Create: `packages/morpho-lab/src/wallet/MetaMaskProvider.tsx`
- Create: `packages/morpho-lab/src/wallet/transaction-state.ts`
- Create: `packages/morpho-lab/src/wallet/transaction-state.test.ts`
- Create: `packages/morpho-lab/src/components/WalletBar.tsx`
- Create: `packages/morpho-lab/src/components/TransactionLog.tsx`
- Modify: `packages/morpho-lab/src/App.tsx`

**Interfaces:**
- Produces: `useMetaMask(): MetaMaskContextValue`.
- Produces: `submitSimulatedWrite(request, summary): Promise<Hash>`.
- Produces: `transactionReducer(state, event): TransactionRecord[]`.

- [ ] **Step 1: Write transaction reducer tests**

```ts
const submitted = transactionReducer([], {
  type: "submitted",
  id: "borrow-1",
  summary: "Borrow 1 USDC",
  hash: "0xabc",
});
expect(submitted[0].status).toBe("pending");
expect(transactionReducer(submitted, { type: "confirmed", id: "borrow-1", blockNumber: 12n })[0].status)
  .toBe("confirmed");
```

Cover rejected signatures and reverted receipts without deleting the original summary.

- [ ] **Step 2: Run the reducer test and verify failure**

Run: `npm run lab:test -- --run src/wallet/transaction-state.test.ts`

Expected: FAIL because the reducer is missing.

- [ ] **Step 3: Implement MetaMask connection and chain enforcement**

```ts
export type MetaMaskContextValue = {
  account?: Address;
  chainId?: number;
  status: "missing" | "disconnected" | "connecting" | "connected";
  publicClient: PublicClient;
  walletClient?: WalletClient;
  connect(): Promise<void>;
  switchToConfiguredChain(): Promise<void>;
  submitSimulatedWrite(args: SimulatedWriteArgs): Promise<Hash>;
};
```

Subscribe to `accountsChanged` and `chainChanged`, clean up listeners on unmount, and never silently select an account.

- [ ] **Step 4: Implement simulate, sign, receipt, and activity state**

`submitSimulatedWrite` first calls `publicClient.simulateContract`, then passes the resulting request to `walletClient.writeContract`, then waits for a successful receipt. A reverted receipt records failure and throws.

- [ ] **Step 5: Render wallet and transaction controls**

Show MetaMask availability, full account, ETH balance from the snapshot, chain ID, connect/switch buttons, technical errors, pending status, and Blockscout transaction links.

- [ ] **Step 6: Run tests and gates**

Run: `npm run lab:test -- --run src/wallet/transaction-state.test.ts`

Expected: PASS.

Run: `npm run lab:typecheck && npm run lab:build`

Expected: PASS.

- [ ] **Step 7: Commit and push**

```bash
git add packages/morpho-lab/src
git commit -m "feat: connect Morpho lab to MetaMask"
git push origin main
```

### Task 4: Build The Protocol Dashboard

**Files:**
- Create: `packages/morpho-lab/src/components/Metric.tsx`
- Create: `packages/morpho-lab/src/components/DeploymentPanel.tsx`
- Create: `packages/morpho-lab/src/components/PoolPanel.tsx`
- Create: `packages/morpho-lab/src/components/AdapterPanel.tsx`
- Create: `packages/morpho-lab/src/components/MarketPanel.tsx`
- Create: `packages/morpho-lab/src/components/AccountPanel.tsx`
- Create: `packages/morpho-lab/src/format.ts`
- Create: `packages/morpho-lab/src/format.test.ts`
- Modify: `packages/morpho-lab/src/App.tsx`
- Modify: `packages/morpho-lab/src/styles.css`

**Interfaces:**
- Consumes: `ProtocolSnapshot` and `MetaMaskContextValue`.
- Produces: responsive read-only dashboard and manual refresh command.

- [ ] **Step 1: Write formatter tests for raw precision and unavailable values**

```ts
expect(formatToken(56_899_999n, 6, 6)).toBe("56.899999");
expect(formatPercent(188_568_737_998_987_965n)).toBe("18.86%");
expect(formatTimestamp(undefined)).toBe("Unavailable");
```

- [ ] **Step 2: Implement shared formatting and metric primitives**

Keep labels, values, raw integer tooltips, addresses, and explorer links structurally stable so changing values do not resize the grid.

- [ ] **Step 3: Render all deployment, pool, adapter, market, and account fields**

Each spec field must map to one explicit metric. Show encrypted handles as truncated hexadecimal with a copy action and the label `Encrypted handle`; never render them as token amounts.

- [ ] **Step 4: Add refresh orchestration**

Refresh on initial load, account change, chain change, manual click, and confirmed transaction. Prevent overlapping refreshes and keep the previous snapshot visible with a stale indicator if a refresh fails.

- [ ] **Step 5: Complete responsive console styling**

Use a restrained neutral palette with status colors, square technical panels, 8px-or-smaller radii, tables that become stacked metrics on narrow screens, and no dependency on SorteCerta's consumer styles.

- [ ] **Step 6: Run tests and build**

Run: `npm run lab:test -- --run src/format.test.ts`

Expected: PASS.

Run: `npm run lab:typecheck && npm run lab:build`

Expected: PASS.

- [ ] **Step 7: Commit and push**

```bash
git add packages/morpho-lab/src
git commit -m "feat: display Morpho protocol dashboard"
git push origin main
```

### Task 5: Implement Lending, Collateral, Borrowing, And Exit Actions

**Files:**
- Create: `packages/morpho-lab/src/protocol/actions.ts`
- Create: `packages/morpho-lab/src/protocol/actions.test.ts`
- Create: `packages/morpho-lab/src/components/AmountAction.tsx`
- Create: `packages/morpho-lab/src/components/Workbench.tsx`
- Create: `packages/morpho-lab/src/components/IncreaseUtilization.tsx`
- Modify: `packages/morpho-lab/src/App.tsx`
- Modify: `packages/morpho-lab/src/styles.css`

**Interfaces:**
- Consumes: validated config, current snapshot, MetaMask account, and `submitSimulatedWrite`.
- Produces: action builders for `wrapEth`, `unwrapWeth`, `supplyUsdc`, `withdrawUsdc`, `supplyCollateral`, `borrowUsdc`, `repayUsdc`, and `withdrawCollateral`.

- [ ] **Step 1: Write failing action-builder tests**

Assert exact function names and argument direction:

```ts
expect(buildBorrow(config, account, 1_000_000n)).toMatchObject({
  address: config.morpho,
  functionName: "borrow",
  args: [expect.any(Object), 1_000_000n, 0n, account, account],
});
```

Cover amount-scoped approvals, repay-all by borrow shares, withdraw-all by supply shares, and WETH deposit/withdraw calls.

- [ ] **Step 2: Write failing validation tests**

Test that borrow amounts above the configured safety margin, collateral withdrawals that make the position unhealthy, zero amounts, amounts above balances, and amounts above market liquidity are rejected before simulation.

- [ ] **Step 3: Implement typed action builders and local guards**

Use the adapter's onchain `marketParams` object for every Morpho call. Approval builders target Morpho and approve only the action amount. Local guards improve feedback; simulation remains authoritative.

- [ ] **Step 4: Build independent workbench controls**

Provide explicit tabs or sections for:

- ETH/WETH;
- direct USDC lending;
- WETH collateral;
- USDC debt; and
- position unwind.

Every form shows available/max values, a confirmation summary, approval state, and the transaction sequence before the first signature.

- [ ] **Step 5: Implement the guided utilization flow**

The workflow takes a WETH collateral amount and USDC borrow amount, defaults borrow to no more than 80% of the LLTV limit, and executes only the missing WETH approval followed by collateral supply and borrow. Stop immediately on rejection or failure and refresh between transactions.

- [ ] **Step 6: Run tests and gates**

Run: `npm run lab:test -- --run src/protocol/actions.test.ts src/protocol/math.test.ts`

Expected: PASS.

Run: `npm run lab:typecheck && npm run lab:build`

Expected: PASS.

- [ ] **Step 7: Commit and push**

```bash
git add packages/morpho-lab/src
git commit -m "feat: add Morpho lending workbench"
git push origin main
```

### Task 6: Move Round Closing Into The Lab

**Files:**
- Create: `packages/morpho-lab/src/protocol/operator-actions.ts`
- Create: `packages/morpho-lab/src/protocol/operator-actions.test.ts`
- Create: `packages/morpho-lab/src/components/OperatorPanel.tsx`
- Modify: `packages/morpho-lab/src/App.tsx`

**Interfaces:**
- Consumes: MetaMask account and transaction submission from Task 3.
- Produces: `closeDraw()` and operator UI.

- [ ] **Step 1: Write failing operator-call tests**

Assert that close-draw targets the current pool with `closeDraw()` and carries no
value or arguments.

- [ ] **Step 2: Implement the round-closing builder**

Return the current pool address, the minimal pool ABI, function name
`closeDraw`, and an empty argument list. Use the same simulation and receipt
pipeline as every other write.

- [ ] **Step 3: Implement the direct-EOA operator action**

Simulate `closeDraw()` before sending it through MetaMask and disable it while
`nextDrawAt` remains in the future.

- [ ] **Step 4: Render operator controls**

Show the current draw ID, active prize, next draw time, and clear action progress.

- [ ] **Step 5: Run tests and gates**

Run: `npm run lab:test -- --run src/protocol/operator-actions.test.ts`

Expected: PASS.

Run: `npm run lab:typecheck && npm run lab:build`

Expected: PASS.

- [ ] **Step 6: Commit and push**

```bash
git add packages/morpho-lab/src
git commit -m "feat: move protocol controls into Morpho lab"
git push origin main
```

### Task 7: Remove The Consumer Admin Surface

**Files:**
- Delete: `packages/web/src/app/admin/page.tsx`
- Modify: `packages/web/src/components/Header.tsx`
- Create: `packages/web/tests/no-admin-route.test.mjs`

**Interfaces:**
- Consumes: lab operator controls from Task 6 as the replacement.
- Produces: consumer app with no `/admin` route or navigation link.

- [ ] **Step 1: Add a failing source-boundary test**

```js
test("consumer app has no admin route or navigation item", async () => {
  await assert.rejects(access(new URL("../src/app/admin/page.tsx", import.meta.url)));
  const header = await readFile(new URL("../src/components/Header.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(header, /href:\s*["']\/admin["']/);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test packages/web/tests/no-admin-route.test.mjs`

Expected: FAIL because the page and navigation entry exist.

- [ ] **Step 3: Delete the route and remove the nav item**

Do not add a redirect, replacement route, or link to the lab.

- [ ] **Step 4: Run consumer and lab gates**

Run: `node --test packages/web/tests/*.test.mjs`

Expected: PASS.

Run: `npm run web:build && npm run lab:build`

Expected: PASS.

- [ ] **Step 5: Commit and push**

```bash
git add packages/web/src/components/Header.tsx packages/web/tests/no-admin-route.test.mjs
git rm packages/web/src/app/admin/page.tsx
git commit -m "refactor: remove consumer admin surface"
git push origin main
```

### Task 8: Verify The Live Local Dashboard And Safe Interaction Path

**Files:**
- Create: `packages/morpho-lab/README.md`
- Modify: `README.md`

**Interfaces:**
- Produces: documented local startup and verified end-to-end lab behavior.

- [ ] **Step 1: Document setup and safety boundaries**

Document:

```bash
npm run lab:dev
# open http://localhost:3001
```

Include MetaMask network requirements, environment override names, configured addresses, action descriptions, liquidation warning, and the fact that the app is local-only and fixed to the current deployment.

- [ ] **Step 2: Run the complete automated verification**

Run:

```bash
npm run contracts:test
npm run lab:test -- --run
npm run lab:typecheck
npm run lab:build
npm run web:build
node --test packages/web/tests/*.test.mjs
git diff --check
```

Expected: every command exits `0`.

- [ ] **Step 3: Start the lab without disturbing the consumer server**

Run: `npm run lab:dev`

Expected: Vite reports `http://localhost:3001` and keeps running.

- [ ] **Step 4: Verify in Vivaldi with MetaMask**

At desktop and narrow-mobile widths verify:

- the app is nonblank with no overlap;
- MetaMask connects and chain switching is offered when needed;
- all configured addresses match live contracts;
- market, adapter, pool, and account metrics match direct RPC reads;
- a rejected signature produces a recoverable error;
- an intentionally excessive borrow is blocked before submission; and
- a small approved action simulates successfully before MetaMask confirmation.

Do not submit a borrow or collateral transaction unless the user explicitly confirms the exact amounts during verification.

- [ ] **Step 5: Confirm the consumer app has no admin page**

Run the consumer app and verify `/admin` returns the framework 404 and no navigation item labeled Admin exists.

- [ ] **Step 6: Commit and push documentation**

```bash
git add README.md packages/morpho-lab/README.md
git commit -m "docs: document local Morpho lab"
git push origin main
```

- [ ] **Step 7: Final repository check**

Run: `git status --short --branch`

Expected: `main` is clean and synchronized with `origin/main`.
