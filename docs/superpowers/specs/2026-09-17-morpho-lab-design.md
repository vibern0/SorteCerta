# Local Morpho Lab Design

## Status

Approved for implementation on 2026-09-17.

## Goal

Add a local-only technical playground for observing and interacting with
SorteCerta's current Sepolia Morpho deployment. The playground must use
MetaMask directly, expose the protocol state needed to understand yield and
withdrawal liquidity, and provide safe lending and borrowing controls that can
increase utilization in the configured USDC/WETH market.

The consumer application must no longer expose an `/admin` page or navigation
entry. Existing prize-funding and round-closing controls move into the local
playground.

## Scope

Create a separate Vite application at `packages/morpho-lab`. It runs on
`localhost:3001`, is not linked from the SorteCerta application, is not included
in the SorteCerta deployment, and never receives a private key.

The lab targets only the current configured deployment and market. It will not
offer arbitrary contract address inputs or recovery controls for retired
deployments.

## Application Architecture

The lab is a React and TypeScript single-page application built with Vite. It
uses MetaMask's EIP-1193 provider for account access and `viem` for checksummed
addresses, reads, transaction simulation, writes, and receipt tracking.

Configuration contains checked-in defaults for:

- Ethereum chain ID `11155111`;
- Circle USDC;
- WETH;
- the current confidential wrapper and prize pool;
- the current Morpho yield adapter;
- the configured Morpho contract and market ID; and
- the market oracle and interest-rate model.

Every value can be overridden through local Vite environment variables. The UI
must display the effective addresses and reject inconsistent configuration,
including a market whose loan token, collateral token, oracle, IRM, or LLTV do
not match the adapter's onchain `marketParams`.

Root scripts provide `lab:dev`, `lab:build`, and `lab:typecheck` commands.

## Wallet And Transaction Model

The lab connects only to MetaMask. It must:

- show the selected account and active chain;
- request a switch to chain ID `11155111` before enabling writes;
- react to account and chain changes;
- use the connected EOA directly, without Web3Auth, account abstraction, a
  paymaster, or stored credentials;
- simulate every contract write before requesting a MetaMask signature;
- show the exact action, asset, amount, and destination before submission; and
- track pending, confirmed, and failed transactions with Blockscout links.

## Protocol Dashboard

The dashboard refreshes on demand and after confirmed transactions. It presents
raw values alongside formatted token amounts.

### Deployment

- Pool, wrapper, adapter, Morpho, USDC, WETH, oracle, and IRM addresses
- Market ID, LLTV, chain ID, block number, and refresh time
- Direct Blockscout links for addresses and transactions

### SorteCerta Pool

- Draw ID, next draw timestamp, participant count, and public prize reserve
- Current withdrawal batch ID and status
- Pending Morpho deposit count
- Last principal unwrap timestamp and configured unwrap interval
- Adapter USDC awaiting supply and accrued yield available to harvest

Encrypted user and aggregate values remain encrypted. The lab displays handles
or an unavailable marker rather than claiming to know their cleartext values.

### Yield Adapter

- Tracked supplied principal
- Idle rounding reserve
- Adapter USDC balance and available principal
- Current supplied assets and accrued yield
- Morpho supply shares
- Difference between tracked principal and currently redeemable backing
- Pool, wrapper, Morpho, and market bindings read from the adapter

### Morpho Market

- Total supply assets and shares
- Total borrow assets and shares
- Available liquidity
- Utilization
- Protocol fee
- Last accrual timestamp
- Current borrow rate and estimated supplier rate when available from the
  configured IRM; otherwise a clearly labeled unavailable value

### Connected Account

- ETH, USDC, and WETH balances
- USDC and WETH allowances
- Morpho supply shares and estimated supplied assets
- Borrow shares and estimated debt
- Supplied WETH collateral
- Oracle-valued collateral, LLTV borrow limit, remaining borrow capacity, and
  current loan-to-value ratio

All conversions must use Morpho's share rounding and oracle scale rules. Prefer
official Morpho SDK primitives where they support the custom deployment; keep
small fallback calculations isolated and covered by unit tests.

## Interactive Workbench

The workbench exposes these independent actions:

1. Wrap ETH into WETH and unwrap WETH into ETH.
2. Approve and supply USDC directly to the configured Morpho market.
3. Withdraw the connected account's direct USDC supply.
4. Approve and supply WETH as collateral.
5. Borrow USDC against supplied WETH.
6. Approve and repay USDC debt.
7. Withdraw WETH collateral when the resulting position remains healthy.

A guided **Increase utilization** workflow combines the required approval,
collateral supply, and USDC borrow calls. It defaults to a conservative safety
margin below LLTV and refuses amounts that simulation or local health checks
identify as unsafe. It does not guarantee protection from oracle movement or
liquidation.

Approval controls default to the entered amount, not unlimited allowance.
Max buttons account for balances, debt, liquidity, collateral constraints, and
rounding. Repay-all and withdraw-all paths use shares where Morpho requires
shares to avoid residual dust.

## Operator Controls

The lab retains the round-closing operation currently found in SorteCerta
`/admin`. Round closing remains permissionless and is disabled until the
onchain close timestamp has passed.

## Consumer App Removal

Delete `packages/web/src/app/admin/page.tsx` and remove `/admin` from the header
navigation. No redirect, replacement route, or link to the local lab is added
to the consumer application.

## Error Handling

The lab must preserve useful technical errors. It distinguishes:

- missing MetaMask;
- rejected connection or signature;
- wrong chain;
- invalid configuration;
- insufficient token, collateral, allowance, or market liquidity;
- unhealthy borrow or collateral withdrawal;
- contract simulation reverts; and
- submitted transaction failures.

Failed actions retain entered values so they can be adjusted and retried.

## Testing

Unit tests cover:

- share-to-asset conversions and rounding;
- utilization and liquidity calculations;
- collateral valuation, LLTV capacity, LTV, and safety margins;
- max action amounts;
- configuration validation; and
- transaction-state transitions.

Build and typecheck gates run for both web applications. Existing web tests and
contract tests remain green. Browser verification uses MetaMask-capable Vivaldi
against `localhost:3001` to confirm connection, dashboard rendering, responsive
layout, and read-only state. Write verification starts with simulation and uses
small explicit test amounts; no retired deployment is touched.

## Non-Goals

- Hosting or deploying the lab
- Supporting networks other than the configured Ethereum chain
- Supporting arbitrary Morpho markets or contracts
- Replacing the keeper
- Recovering retired pool funds
- Adding authentication beyond MetaMask
- Reusing the consumer application's visual design system
