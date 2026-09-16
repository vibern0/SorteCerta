# Road to Mainnet

SorteCerta's current target remains the Ethereum Sepolia Zama bounty demo.
Mainnet is a separate, gated program for real funds. Passing one phase does not
waive any later gate.

## Plans

| Workstream | Detailed plan | Exit result |
| --- | --- | --- |
| Protocol correctness | [`2026-09-16-protocol-correctness.md`](superpowers/plans/2026-09-16-protocol-correctness.md) | Correct weighted draws, minimum-prize rounds, production roles, emergency controls |
| Liquidity and automation | [`2026-09-16-liquidity-and-automation.md`](superpowers/plans/2026-09-16-liquidity-and-automation.md) | Withdrawal queue, two keeper workers, managed transaction queue |
| Network and deployment | [`2026-09-16-network-and-deployment.md`](superpowers/plans/2026-09-16-network-and-deployment.md) | Proven Zama mainnet support, deterministic deployment, canary environment |
| Security and launch | [`2026-09-16-security-and-launch.md`](superpowers/plans/2026-09-16-security-and-launch.md) | Audit clearance, operational readiness, legal approval, capped beta |

The binding architecture is documented in
[`2026-09-16-mainnet-readiness-design.md`](superpowers/specs/2026-09-16-mainnet-readiness-design.md).

## Critical path

1. Prove Zama's required flows on Ethereum mainnet with disposable canary
   contracts. Stop if this gate fails.
2. Correct weighted selection and add invariant tests. The existing fixed
   ticket range is not safe for real deposits.
3. Replace owner-dependent liquidity restoration with an asynchronous,
   confidential withdrawal queue.
4. Split draw and Morpho automation into independent workers using one managed
   transaction queue.
5. Replace the immutable deployer owner with Safe/timelock governance and
   narrow operational roles.
6. Deploy a fresh Sepolia release candidate and run deposit, route, accrue,
   harvest, draw, decrypt, claim, withdrawal, outage, and recovery scenarios.
7. Complete independent audit, remediate every accepted finding, freeze the
   release commit, and repeat the full release-candidate suite.
8. Deploy a 100 USDC mainnet canary. Reconcile contract balances, Morpho
   position, prize reserve, and withdrawal liabilities after every transition.
9. Obtain jurisdiction-specific legal approval and publish the risk,
   eligibility, privacy, fee, withdrawal, and incident disclosures.
10. Open an invite-only beta capped at 10,000 USDC. Raise caps only through the
    timelock after 30 incident-free days and a written readiness review.

## Program gates

### Gate A: feasibility

- Zama input encryption, user decryption, public decryption, FHE randomness,
  ERC-7984 wrapping, and proof verification work on Ethereum mainnet.
- Canonical Ethereum USDC wraps and unwraps correctly.
- The selected Morpho market has sufficient supply, borrow demand, and exit
  liquidity for the launch cap.
- Projected net yield exceeds expected automation and draw gas costs by at
  least 2x under the conservative utilization scenario.

Failure at Gate A keeps the product on Sepolia.

### Gate B: protocol correctness

- Weighted-selection property tests pass for boundary deposits, 32 users, and
  repeated randomized distributions.
- No participant can gain probability from registration order.
- Withdrawal requests stop earning draw weight immediately and settle within
  the configured objective under keeper failover tests.
- Deposits can be paused without blocking withdrawal requests or claims.
- Every privileged path is mapped to a multisig/timelock or narrow operator
  role; no production contract is owned by a developer EOA.

### Gate C: release candidate

- All contract, frontend, keeper, integration, and fork tests pass from a clean
  checkout at the release commit.
- Source code is verified and deployment manifests reproduce every address and
  constructor argument.
- Two RPC providers, relayer/KMS signing, metrics, paging, reconciliation, and
  incident runbooks are exercised on Sepolia.
- An independent audit has no unresolved critical or high-severity findings.

### Gate D: mainnet canary

- The protocol cap is 100 USDC and only operator accounts participate.
- At least three complete rounds and two complete withdrawal batches settle.
- Accounting reconciliation reports zero unexplained difference.
- Keeper failover and pause/recovery drills complete without lost funds or
  duplicate state transitions.

### Gate E: invite-only beta

- Legal counsel approves the launch jurisdictions and disclosures.
- The protocol cap is 10,000 USDC and the account cap is 1,000 USDC.
- Multisig signers, monitoring rotations, escalation contacts, and funded gas
  budgets are active.
- Cap increases require a timelocked transaction and a written 30-day review.

## Explicit launch blockers in the current implementation

- queued withdrawals exist, but batch restoration still needs Zama
  public-decryption proof verification and keeper reconciliation before it can
  protect real funds.
- the keeper and frontend are hard-coded to Sepolia and the keeper stores a raw
  private key in its runtime environment.
- the pool uses an immutable single owner rather than transferable multisig and
  timelock governance.
- draw closing has no automated production worker.
- log scanning, retries, alerts, reconciliation, reorg handling, and incident
  recovery are not production-grade.
- the contracts have not completed an independent audit for real funds.
- regulatory, eligibility, tax, sanctions, and consumer disclosures have not
  been approved for any launch jurisdiction.
