# Network and Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the exact Zama/Ethereum production stack, remove Sepolia hard-coding, and produce deterministic, verifiable release-candidate and mainnet deployments.

**Architecture:** Centralize chain configuration, run a disposable mainnet compatibility canary before full deployment, and generate immutable deployment manifests consumed by contracts, frontend, and keeper.

**Tech Stack:** Hardhat, viem, Zama FHEVM/Relayer SDK, Ethereum, canonical USDC, Morpho Blue, Safe, block-explorer verification.

**Spec:** `docs/superpowers/specs/2026-09-16-mainnet-readiness-design.md`

## Global Constraints

- Checksum every address passed to Zama SDK and relayer methods.
- Never print, commit, or place signing keys in deployment manifests.
- Mainnet deployment stops if any Zama canary flow fails.
- Only canonical Ethereum USDC is accepted on mainnet.
- Every address and constructor argument is verified independently before use.

---

### Task 1: Create typed network configuration

**Files:**
- Create: `packages/config/src/networks.ts`
- Create: `packages/config/test/networks.test.ts`
- Modify: `packages/contracts/hardhat.config.ts`
- Modify: `packages/web/src/lib/wagmi.ts`
- Modify: `packages/web/src/lib/zama.ts`
- Modify: `packages/web/src/lib/contracts.ts`

**Interfaces:**
- Produces: `getNetworkConfig(chainId: 1 | 11155111): NetworkConfig`
- Produces validated USDC, Morpho, relayer, gateway, RPC, explorer, and deployment-manifest fields

- [ ] **Step 1: Add failing configuration tests**

Assert unsupported chain rejection, checksum normalization, missing-field
rejection, canonical USDC addresses, and absence of secrets in serialized config.

- [ ] **Step 2: Verify red state**

Run: `pnpm --dir packages/config test`

Expected: FAIL because the config package does not exist.

- [ ] **Step 3: Implement config and replace hard-coded Sepolia imports**

Select viem chain, Zama SDK config, and contract manifest from chain ID. Make the
frontend fail closed with a clear unsupported-network state instead of silently
using Sepolia.

- [ ] **Step 4: Run repository gates and commit**

Run: `pnpm --dir packages/config test && cd packages/contracts && pnpm compile && cd ../web && pnpm typecheck && pnpm build`

```bash
git add packages/config packages/contracts/hardhat.config.ts packages/web/src/lib
git commit -m "refactor: centralize supported network configuration"
```

### Task 2: Build the Ethereum mainnet Zama canary

**Files:**
- Create: `packages/contracts/contracts/MainnetZamaCanary.sol`
- Create: `packages/contracts/scripts/deploy-mainnet-zama-canary.ts`
- Create: `packages/contracts/scripts/verify-mainnet-zama-canary.ts`
- Create: `docs/evidence/mainnet-zama-canary.md`

**Interfaces:**
- Proves encrypted input, ACL, user decrypt, public decrypt with proof,
  ERC-7984 wrap/unwrap, and FHE random generation on chain ID 1

- [ ] **Step 1: Pin and record exact production dependencies**

Record package versions, official Ethereum FHE host addresses, relayer URL,
gateway chain ID, and checksum addresses from current Zama documentation. Fail
the script when any value differs from the reviewed manifest.

- [ ] **Step 2: Implement a disposable canary contract**

Expose one minimal path for encrypted input/user decrypt and one for random
value/public decrypt/proof verification. The canary holds no user deposits.

- [ ] **Step 3: Deploy with a funded canary account and execute every path**

Run the deployment and verification scripts against chain ID 1. Record
transaction hashes, blocks, gas, HCU usage, relayer latency, and proof latency.

- [ ] **Step 4: Apply the hard gate**

If any path fails, document the exact unsupported flow and stop all remaining
mainnet deployment tasks. Do not introduce a plaintext fallback.

- [ ] **Step 5: Commit reproducible evidence**

```bash
git add packages/contracts/contracts/MainnetZamaCanary.sol packages/contracts/scripts/deploy-mainnet-zama-canary.ts packages/contracts/scripts/verify-mainnet-zama-canary.ts docs/evidence/mainnet-zama-canary.md
git commit -m "test(mainnet): prove Zama production compatibility"
```

### Task 3: Select and freeze the Morpho market

**Files:**
- Create: `packages/contracts/scripts/validate-morpho-market.ts`
- Create: `docs/risk/mainnet-morpho-market.md`
- Create: `packages/contracts/test/MainnetMorphoFork.test.ts`

**Interfaces:**
- Produces a reviewed immutable tuple of loan token, collateral token, oracle,
  IRM, LLTV, market ID, and Morpho address

- [ ] **Step 1: Validate candidates from official onchain/API data**

Require canonical USDC as loan token, governance-approved IRM/LLTV, recognized
oracle, adequate available liquidity, nonzero borrow demand, and no active risk
warning. Reject any candidate failing one condition.

- [ ] **Step 2: Model conservative economics**

Calculate net yield after Morpho fee, keeper gas, draw gas, FHE operations, and
a 2x gas-price stress. The selected minimum prize must be at least twice the
expected round automation cost.

- [ ] **Step 3: Add mainnet-fork tests**

Test supply, accrue, harvest, full principal restoration at the launch cap,
temporary illiquidity handling, and adapter accounting against the frozen tuple.

- [ ] **Step 4: Run and commit**

Run: `cd packages/contracts && MAINNET_FORK_RPC_URL=... pnpm hardhat test test/MainnetMorphoFork.test.ts`

```bash
git add packages/contracts/scripts/validate-morpho-market.ts packages/contracts/test/MainnetMorphoFork.test.ts docs/risk/mainnet-morpho-market.md
git commit -m "test(mainnet): freeze and verify the Morpho market"
```

### Task 4: Produce deterministic deployment manifests

**Files:**
- Create: `packages/contracts/scripts/deploy-release.ts`
- Create: `packages/contracts/scripts/verify-release.ts`
- Create: `deployments/schema.json`
- Create at runtime: `deployments/<chain-id>/<release>.json`
- Modify: `packages/web/src/lib/contracts.ts`
- Modify: `packages/keeper/src/config.ts`

**Interfaces:**
- Produces signed-off JSON with chain ID, git commit, bytecode hashes, deployer,
  constructor args, addresses, transaction hashes, blocks, and verification URLs

- [ ] **Step 1: Add manifest schema tests**

Reject missing bytecode hash, non-checksum address, wrong chain, duplicate
address, secret-like field, unverified source, and mismatched constructor input.

- [ ] **Step 2: Implement deployment and independent verification**

Deploy in dependency order, wait for confirmations, verify source, reread every
immutable/config value, and write the manifest only after all checks pass.

- [ ] **Step 3: Make frontend and keeper consume the manifest**

Remove duplicated address environment variables. Permit an environment override
only when its chain ID and bytecode hash match the manifest.

- [ ] **Step 4: Execute on a fresh Sepolia release candidate**

Run all deployment, verification, frontend, keeper, and two-wallet end-to-end
flows. Preserve the evidence in `docs/evidence/sepolia-release-candidate.md`.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/scripts deployments packages/web/src/lib/contracts.ts packages/keeper/src/config.ts docs/evidence/sepolia-release-candidate.md
git commit -m "feat(deploy): make releases deterministic and verifiable"
```
