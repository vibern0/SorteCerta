# Future Goal: Standard Vault Yield Integration

Status: deferred. Finish and verify automatic USDC withdrawals on the current
architecture first. Research snapshot: September 16, 2026.

## Goal

Reduce custom yield and settlement code by evaluating a curated Morpho ERC-4626
vault and the OpenZeppelin batching primitive used by Zama. Keep SorteCerta's
encrypted principal, draw eligibility, FHE winner selection, and prize accounting.
Users should make one withdrawal request; background services complete delivery
and the UI shows pending funds until USDC actually arrives.

## Findings

- Zama announced 16 confidential Morpho vaults across five asset classes on
  September 15. This establishes live Ethereum products, not a verified,
  yield-producing Sepolia integration for SorteCerta.
- Our current `MorphoYieldAdapter` manages a Morpho Blue market position directly.
  A vault adapter could instead use deposit, withdraw/redeem, and share valuation,
  leaving market allocation to the selected vault's curator and allocators.
- Morpho Vault V2 supports ERC-4626 operations, real-time asset reporting, idle
  liquidity, and liquidity adapters. Its maxDeposit/maxMint/maxWithdraw/maxRedeem
  methods return zero by design: do not use these as ordinary liquidity quotes.
- Morpho's recommended TypeScript entry point is `@morpho-org/morpho-sdk` for
  reads and transaction construction. Evaluate it for keeper liquidity planning.
- Zama's gateway uses OpenZeppelin `BatcherConfidential`, already present in our
  installed confidential-contracts dependency. The base handles aggregation,
  wrap/unwrap orchestration, exchange rates, distribution, and recovery. Their
  route adds vault deposit/redeem, deadlines, slippage protection, and batch age.
- A Zama vault gateway has separate deposit/redeem batchers and a confidential
  share wrapper. Do not stack this on top of our existing batching without
  proving that the added asynchronous stages are necessary.
- Confidential exits remain asynchronous. Zama's product page describes roughly
  daily batches and a faster unshield-shares/redeem route that reveals the exit
  amount. Verify actual deployment parameters; do not promise a fixed duration.
- Bundler3 combines synchronous calls atomically. It cannot wait for a future
  decryption proof inside the same transaction and does not replace our keeper.

## Candidate Direction

1. Keep pool-level ownership of the investment position. Preserve user principal
   liabilities separately and distribute only realized surplus as prizes.
2. Replace direct market management with a thin ERC-4626 yield adapter where a
   suitable supported vault exists.
3. Compare reusing the generic batcher with using Zama's deployed gateway. Prefer
   one settlement system, with explicit failure recovery and no second user claim.
4. Preserve a liquid reserve if shorter withdrawal latency is required. A reserve
   reduces invested capital and does not guarantee unlimited immediate exits.
5. Keep the current sponsor-funded fallback for the Sepolia demo.

## Acceptance Gates

- Verify chain, canonical token/wrapper, vault and batcher addresses, source,
  pinned versions, licenses, audits, access restrictions, and keeper availability.
- Verify Sepolia deployment and actual yield behavior directly. Public registry
  research did not establish a supported yield-producing Sepolia vault; third-party
  demo claims alone are insufficient. Do not switch networks to use mainnet vaults.
- Prove deposit, yield realization, partial/full withdrawal, rounding, fees,
  insufficient liquidity, delayed proofs, cancellation/recovery, and restart safety.
- Prove no principal or pending withdrawal backing can be awarded as prizes.
  Lending losses remain possible; the no-loss prize mechanic is not insurance.
- Verify one user withdrawal action completes to wallet USDC with truthful pending
  states, including when the browser is closed.
- Compare removed code and operational dependencies before accepting the change.

## Sources

- [Zama expansion announcement](https://www.zama.org/post/confidential-defi-at-scale)
- [Zama vault engineering design](https://www.zama.org/post/private-deposits-into-public-defi-zamas-first-confidential-vault-design)
- [Zama vault product and withdrawal options](https://www.zama.org/confidential-vaults)
- [Morpho Vault V2](https://github.com/morpho-org/vault-v2)
- [Morpho SDKs](https://github.com/morpho-org/sdks)
- [Morpho Bundler3](https://github.com/morpho-org/bundler3)
- [OpenZeppelin BatcherConfidential](https://github.com/OpenZeppelin/openzeppelin-confidential-contracts/blob/master/contracts/finance/BatcherConfidential.sol)
- [Zama public deployment registry](https://github.com/zama-ai/protocol-registry)

The X posts supplied during research could not be fetched directly; findings
above were checked against the official engineering articles and repositories.
