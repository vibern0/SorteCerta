# TODO

## Frontend: deposit and withdraw bottom sheet validation

Status: queued for the judge-facing frontend work.

Goal: before a user confirms a deposit or withdrawal from the bottom sheet,
validate the action and show clear, user-safe feedback without exposing protocol
implementation details in product copy.

Deposit validation should cover:

- Connected account and supported network are ready.
- Amount is present, positive, and within token decimal precision.
- User has enough available token balance for the requested deposit.
- Required allowance, wrapping, or account setup step is missing or ready.
- The pool is currently accepting deposits.
- Zama encrypted input/proof preparation is ready before the transaction is
  submitted.

Withdrawal validation should cover:

- Connected account and supported network are ready.
- Amount is present, positive, and within token decimal precision.
- User has enough available principal for the requested withdrawal, based on the
  app's latest known account state.
- The withdrawal flow can proceed while a draw or claim state is in progress.
- Zama encrypted input/proof preparation is ready before the transaction is
  submitted.

UX notes:

- Keep copy short, concrete, and product-facing. Avoid implementation/privacy
  words banned by `AGENTS.md`.
- Disable the primary confirm action until blocking validation passes.
- Prefer inline field errors for amount issues and bottom-sheet level alerts for
  account, network, allowance, or app-state blockers.
- Re-check validation immediately before submit so stale balance or allowance
  data cannot launch a doomed transaction.

## Frontend: background async actions

Status: queued for the judge-facing frontend work.

Goal: let long-running user actions continue in the background so the user can
leave the current screen after submitting a deposit, withdrawal, claim, faucet,
approval, wrap, draw, or balance/winnings check.

Expected behavior:

- When an action is submitted, create a tracked action record with label, type,
  timestamps, account, relevant transaction hash or request id, and current
  status.
- Let the UI return to the normal app state while the action progresses.
- Add a persistent UI access point where users can review running, completed,
  and failed actions.
- Show useful per-action states: preparing, waiting for wallet, submitted,
  confirming, updating account, completed, failed, and dismissed.
- Allow retry for recoverable failed actions and safe dismissal for completed or
  failed actions.
- Keep action tracking resilient across route changes and browser refreshes when
  possible.
- Refresh affected account and pool data when an action completes.

Implementation notes:

- Model async actions centrally instead of burying transaction state inside each
  page component.
- Store enough metadata to resume watching known transaction hashes after a
  refresh.
- Treat rejected wallet prompts differently from submitted transactions that
  later fail.
- The access point should be visible from core app screens without trapping the
  user in the originating bottom sheet.

## Later: Morpho USDC/WETH yield adapter

Status: deferred until the Sepolia bounty demo is stable end to end.

Goal: replace or supplement the sponsor-funded prize source with real USDC yield
from a Morpho Blue USDC/WETH market on Ethereum Sepolia.

Current research snapshot from August 26, 2026:

- Morpho Blue is deployed on Sepolia at
  `0xd011EE229E7459ba1ddd22631eF7bF528d424A14`.
- The observed USDC/WETH market uses USDC as `loanToken` and WETH as
  `collateralToken`.
- SorteCerta would supply only USDC. Users do not deposit WETH.
- WETH is deposited by borrowers as collateral. Borrowers borrow USDC and pay
  interest; SorteCerta earns that interest as the USDC supplier.
- Observed market id:
  `0x8c561f0929c3a3e2b20fba99c2ae15fc57b4d0599e4371b67c9a58388a27b9d2`.
- Observed market parameters:
  - `loanToken`: Circle Sepolia USDC
    `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`
  - `collateralToken`: Sepolia WETH
    `0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9`
  - `lltv`: `945000000000000000`
- Recent onchain state showed borrow activity and interest accrual, so yield was
  working at the time of research.

Integration shape:

1. Keep user deposits as USDC into SorteCerta.
2. Keep principal accounting and draw eligibility inside `ConfidentialPrizePool`.
3. Add a separate owner/keeper-controlled yield adapter that supplies idle USDC
   to Morpho.
4. Periodically withdraw realized yield from Morpho and fund the prize reserve.
5. Do not expose Morpho positions as user balances; SorteCerta remains the pool
   accounting source of truth.

Risks and open questions:

- Morpho Blue direct market integration is more complex than an ERC-4626 vault:
  calls require exact `MarketParams`, and the contract tracks supply shares
  rather than issuing a simple vault receipt token.
- Withdrawals can be constrained by available market liquidity when utilization
  is high.
- Morpho's public API did not accept Sepolia `chainId 11155111` during research,
  so the integration should hardcode verified market parameters or use direct
  onchain reads.
- Re-check market liquidity, borrow demand, oracle, IRM, and token addresses
  before implementation.
- Keep the sponsor-funded prize path as a fallback for judge demos.

Implementation is intentionally out of the bounty-critical path. Build this only
after deposit, draw, claim, withdraw, and frontend flows are stable on Sepolia.
