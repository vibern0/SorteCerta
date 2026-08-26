# TODO

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
