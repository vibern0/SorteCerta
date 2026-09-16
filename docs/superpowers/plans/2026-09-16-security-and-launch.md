# Security and Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert a verified release candidate into a legally and operationally controlled mainnet canary and capped beta.

**Architecture:** Freeze a release commit, obtain independent security review, deploy under Safe/timelock governance, rehearse incidents, then raise immutable or timelocked caps in stages backed by reconciliation evidence.

**Tech Stack:** Hardhat, Slither, Echidna/Foundry invariant testing, Safe multisig, OpenZeppelin TimelockController, monitoring/paging, verified deployment manifests.

**Spec:** `docs/superpowers/specs/2026-09-16-mainnet-readiness-design.md`

## Global Constraints

- No unresolved critical or high-severity audit finding at launch.
- No production developer EOA retains admin authority.
- Deposit pausing cannot block withdrawal requests or claims.
- Canary cap is 100 USDC; invite-only beta cap is 10,000 USDC.
- Cap increases require a timelock and a written readiness record.
- Launch requires jurisdiction-specific legal approval.

---

### Task 1: Build the security verification matrix

**Files:**
- Create: `packages/contracts/test/invariant/Accounting.invariant.sol`
- Create: `packages/contracts/test/invariant/Draw.invariant.sol`
- Create: `packages/contracts/test/invariant/Authorization.invariant.sol`
- Create: `docs/security/verification-matrix.md`
- Modify: `packages/contracts/package.json`

**Interfaces:**
- Produces automated gates for accounting conservation, draw uniqueness,
  withdrawal liveness, authorization, replay protection, and cap enforcement

- [ ] **Step 1: Define executable invariants**

Include principal conservation, yield/principal separation, one claim per award,
one settlement per withdrawal, ticket range correctness, no post-request draw
weight, role isolation, pause safety, and Zama proof replay rejection.

- [ ] **Step 2: Add static and fuzz commands**

Pin tool versions and add scripts that fail on new high-confidence findings or
invariant counterexamples. Store seeds and minimized counterexamples as test
fixtures.

- [ ] **Step 3: Run the full matrix**

Run unit, invariant, fuzz, static, coverage, gas/HCU, mainnet-fork, frontend,
keeper, and end-to-end suites from a clean checkout. Record command, commit,
duration, and result in the matrix.

- [ ] **Step 4: Commit**

```bash
git add packages/contracts/test/invariant packages/contracts/package.json docs/security/verification-matrix.md
git commit -m "test(security): enforce protocol invariants"
```

### Task 2: Complete independent audit and remediation

**Files:**
- Create: `docs/security/audit-scope.md`
- Create: `docs/security/audit-remediation.md`
- Add: final auditor report under `docs/security/audits/`

- [ ] **Step 1: Freeze and scope the audit commit**

List every contract, library version, deployment script, privileged role,
external dependency, trust assumption, and excluded legacy prototype. Include
the withdrawal batch, Morpho adapter, draw math, and proof verification.

- [ ] **Step 2: Commission an independent audit**

Require manual review plus invariant/fuzz review and a dedicated review of FHE
ACLs, public-decryption proof verification, randomness scaling, and confidential
state leakage.

- [ ] **Step 3: Triage every finding**

For each finding record severity, disposition, fixing commit, regression test,
reviewer confirmation, and deployment impact. Launch is blocked by unresolved
critical/high findings or unreviewed accepted risk affecting principal.

- [ ] **Step 4: Freeze the release candidate**

Tag the remediated commit, rerun the verification matrix, and permit no code
change afterward without reopening review for the affected scope.

- [ ] **Step 5: Commit public artifacts**

```bash
git add docs/security
git commit -m "docs(security): publish audit scope and remediation"
```

### Task 3: Configure governance and operations

**Files:**
- Create: `deployments/mainnet/governance.json`
- Create: `docs/runbooks/emergency-pause.md`
- Create: `docs/runbooks/contract-migration.md`
- Create: `docs/runbooks/key-and-signer-incident.md`
- Create: `docs/operations/service-levels.md`

- [ ] **Step 1: Create the Safe and timelock configuration**

Use at least three independent hardware-backed signers with a two-of-three
threshold. Make the Safe the timelock proposer, give execution to the Safe plus
an explicitly reviewed public executor policy, and verify no deployer EOA role
remains.

- [ ] **Step 2: Fund and constrain operational signers**

Fund only the gas budget required for the defined runway. Restrict relayer
policies to chain ID 1, approved contract addresses, zero ETH value, approved
method selectors, and bounded gas.

- [ ] **Step 3: Define service levels and alerts**

Set draw evaluation to one minute, Morpho evaluation to five minutes,
withdrawal settlement target to four hours, critical page acknowledgement to
15 minutes, and reconciliation at every state-changing receipt plus hourly.

- [ ] **Step 4: Rehearse all runbooks on Sepolia**

Exercise deposit pause, worker outage, signer outage, RPC failover, Zama relayer
outage, stuck transaction, Morpho illiquidity, reconciliation mismatch, and new
contract migration. Record evidence and corrective actions.

- [ ] **Step 5: Commit**

```bash
git add deployments/mainnet/governance.json docs/runbooks docs/operations
git commit -m "docs(ops): define mainnet governance and incident response"
```

### Task 4: Complete legal and product launch review

**Files:**
- Create: `docs/launch/jurisdiction-matrix.md`
- Create: `docs/launch/product-disclosures.md`
- Create: `docs/launch/privacy-data-map.md`
- Create: `docs/launch/support-and-complaints.md`

- [ ] **Step 1: Give counsel an exact product description**

Document prize funding, eligibility timing, no-loss limitations, variable yield,
withdrawal settlement, public chain data, confidential data, operators, fees,
geographies, sanctions controls, tax reporting, and incident powers.

- [ ] **Step 2: Convert legal conclusions into launch controls**

Record allowed jurisdictions, excluded users, required eligibility language,
age restrictions, terms acceptance, privacy disclosures, record retention, and
support/escalation requirements. Implement geo or identity controls only when
required by the signed legal conclusion.

- [ ] **Step 3: Validate product copy**

Ensure the UI describes eligibility at the end of the actual round, never
guarantees a prize, explains variable settlement time, and avoids unsupported
claims about principal safety, privacy, yield, or availability.

- [ ] **Step 4: Obtain written launch approval**

Store approval date, jurisdictions, product version, contract release commit,
and conditions in the private compliance record; publish only the customer-facing
terms and disclosures.

- [ ] **Step 5: Commit public documents**

```bash
git add docs/launch
git commit -m "docs(launch): add approved mainnet disclosures"
```

### Task 5: Run the canary and capped beta

**Files:**
- Create: `docs/evidence/mainnet-canary.md`
- Create: `docs/evidence/mainnet-beta-readiness.md`
- Update: `docs/ROAD_TO_MAINNET.md`

- [ ] **Step 1: Deploy the 100 USDC canary**

Deploy from the frozen commit, verify sources and manifests, transfer control to
Safe/timelock, set the 100 USDC protocol cap, and allow only operator accounts.

- [ ] **Step 2: Exercise complete real-fund lifecycles**

Complete at least three rounds and two withdrawal batches, including one USDC
unwrap. Reconcile principal, yield, prizes, liabilities, and balances after each
transaction.

- [ ] **Step 3: Exercise failure recovery**

Disable the primary worker, fail over RPC and signer submission, pause deposits,
restore service, and verify no duplicate or missing transitions.

- [ ] **Step 4: Approve invite-only beta**

Require zero unexplained accounting difference, met service levels, no critical
alerts, completed audit gates, completed legal gate, and multisig approval.
Increase the cap through the timelock to 10,000 USDC.

- [ ] **Step 5: Apply the 30-day expansion gate**

After 30 incident-free days, publish the readiness record covering volume,
yield, gas, withdrawal latency, keeper availability, relayer failures, support
cases, and reconciliation. Any cap increase requires a new timelocked proposal.

- [ ] **Step 6: Commit evidence**

```bash
git add docs/evidence docs/ROAD_TO_MAINNET.md
git commit -m "docs(mainnet): record canary and beta readiness"
```
