# SorteCerta Mainnet Readiness Design

## Purpose

This design defines the work required to move SorteCerta from its Ethereum
Sepolia bounty deployment to a limited-value Ethereum mainnet beta using real
USDC and Morpho yield. The Sepolia deployment remains the bounty submission and
must stay operational while mainnet work proceeds in a separate deployment.

## Launch definition

“Mainnet launch” means all of the following are true:

- users deposit canonical Ethereum USDC and receive confidential ERC-7984
  balances;
- deposit-weighted winner selection is mathematically correct for every
  supported deposit distribution;
- draws close automatically and prizes can be decrypted and claimed;
- deposits are routed to an approved Morpho market without preventing users
  from initiating withdrawals;
- withdrawal requests settle within a documented service-level objective;
- no raw operator private key is stored in application environment variables;
- privileged actions are controlled by a Safe multisig and timelock;
- independent reviewers have cleared the contracts and launch configuration;
- monitoring, incident response, accounting reconciliation, and rollback
  procedures have been exercised before accepting unrestricted deposits.

## Non-goals

- Mainnet is not required for the Zama bounty submission.
- The Sepolia contracts will not be upgraded or migrated in place.
- The launch will not introduce cross-chain deposits, leverage, protocol fees,
  governance tokens, or multiple yield markets.
- The first mainnet beta will not promise instant withdrawal settlement; it will
  publish and enforce a bounded withdrawal-settlement objective.

## Architecture decisions

### Separate deployment

Mainnet uses newly deployed contracts and an isolated environment. Network,
contract addresses, RPC endpoints, relayer endpoints, monitoring, and operator
accounts are selected through one typed network configuration. Sepolia remains
available as the release-candidate environment.

### Correct confidential draw math

The fixed `MAX_DRAW_TICKETS` range is removed. A 64-bit encrypted random value
is widened to 128 bits and multiplied by encrypted total principal. The high
64 bits of that product form an encrypted ticket uniformly distributed across
`[0, totalPrincipal)`. The maximum aggregate principal is bounded below 2^64,
so the 128-bit product cannot overflow.

The draw closes only after its deadline, with at least one participant and a
public prize at or above `minimumPrize`. If the threshold is not met, the round
stays open and the UI says that the prize is still building. `minimumPrize` is
an immutable deployment parameter calculated so the prize is at least twice
the expected draw and keeper gas cost expressed in USDC.

### Withdrawal queue and liquidity

Depositors can request a withdrawal at any time. A request immediately reduces
their encrypted active principal, removing it from future draw weight. The
encrypted requested amounts accumulate into a batch. The keeper publicly
decrypts only the batch total, restores that amount from Morpho, wraps it as
confidential USDC, and marks the batch claimable. Users then claim their
encrypted amount. The product publishes a target settlement time and exposes
batch status without exposing individual amounts.

### Automation topology

One deployable keeper service contains two independent workers:

- the Morpho worker handles deposit batches, public decryption, supply, accrual,
  yield harvest, and withdrawal liquidity restoration;
- the draw worker checks the round deadline and minimum prize, then calls the
  permissionless `closeDraw()` method.

The workers share a transaction queue but have separate schedules, health
checks, metrics, and alert policies. This prevents a Zama or Morpho failure from
blocking draw evaluation while preventing nonce races. The transaction signer
is backed by KMS or a dedicated relayer; no raw mainnet key reaches the worker.

### Governance and emergency controls

The deployer is not the permanent owner. Administrative permissions are held by
a Safe multisig behind a timelock. Operational functions are permissionless or
restricted to narrowly scoped roles. Emergency controls can pause new deposits
and new Morpho supply while preserving withdrawal requests and claims. Market,
adapter, cap, and timing changes emit events and use delayed execution.

### Mainnet compatibility gate

Mainnet deployment cannot proceed until the exact Zama Solidity package,
relayer SDK, Ethereum host contracts, relayer URL, and public/user-decryption
flows pass a funded Ethereum mainnet canary. If production Zama infrastructure
does not support the required flows, the project stays on Sepolia; it does not
ship a plaintext fallback under the SorteCerta mainnet brand.

## Rollout stages

1. Local and fork verification with adversarial and invariant tests.
2. New Sepolia release candidate with two-wallet end-to-end validation.
3. Independent audit and remediation freeze.
4. Mainnet canary with operator-only funds and a 100 USDC protocol cap.
5. Invite-only beta with a 10,000 USDC protocol cap and 1,000 USDC account cap.
6. Cap increases only after 30 days of successful reconciliation, withdrawal
   settlement, keeper availability, and incident-free operation.

## Required launch evidence

- deterministic deployment manifests and verified source code;
- audit report plus remediation mapping;
- invariant, fuzz, integration, fork, and end-to-end test results;
- mainnet Zama compatibility transaction evidence;
- selected Morpho market risk memo and exit-liquidity evidence;
- keeper availability, gas, nonce, and alert dashboards;
- multisig/timelock ownership verification;
- incident, pause, recovery, and contract-migration drills;
- jurisdiction-specific legal approval and published product disclosures.

## Authoritative external references

- Zama Protocol configuration and production-network documentation:
  <https://docs.zama.org/protocol/solidity-guides/smart-contract>
- Zama public-decryption proof requirements:
  <https://docs.zama.org/protocol/solidity-guides/smart-contract/oracle>
- Circle canonical USDC contract addresses:
  <https://developers.circle.com/stablecoins/usdc-contract-addresses>
- Morpho contract addresses and market-risk documentation:
  <https://docs.morpho.org/developers/contracts/addresses/> and
  <https://docs.morpho.org/learn/resources/risks/>
- OpenZeppelin mainnet administration guidance:
  <https://docs.openzeppelin.com/contracts/5.x/learn/preparing-for-mainnet>
- OpenZeppelin Relayer signer options:
  <https://docs.openzeppelin.com/defender/migration>
