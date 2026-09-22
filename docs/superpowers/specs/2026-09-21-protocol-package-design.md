# Shared Protocol Package Design

## Status

Approved for implementation planning on 2026-09-22.

## Goal

Create `packages/protocol` as the single reusable TypeScript boundary for
Morpho behavior and SorteCerta contract integration shared by the consumer web
application, the local Morpho lab, and server-side keepers.

The package must remove duplicate market types, arithmetic, tuple parsing,
contract ABIs, pinned-block reads, and amount parsing without changing deployed
contracts, configured Sepolia addresses, transaction semantics, or user-facing
flows.

Official Morpho SDK functionality is the source of truth wherever it exists.
`@sortecerta/protocol` supplies only the missing SorteCerta-specific layer and
small compatibility adapters needed by the current Sepolia deployment.

## Scope And Ownership

`@sortecerta/protocol` owns deterministic, environment-independent behavior:

- selected Morpho entities, types, arithmetic, and standard ABIs sourced from
  the official SDK;
- checksummed construction and comparison of Morpho market parameters;
- strict decoding of custom adapter and contract tuple results;
- SorteCerta contract ABIs used outside the Solidity package;
- typed contract reads that accept an RPC client and explicit block number;
- snapshot functions that pin every associated read to one block;
- protocol transaction request builders that do not submit or sign; and
- canonical token amount parsing.

Consumers retain environment and interaction policy:

- creating RPC clients and selecting endpoints from environment configuration;
- selecting the latest, watched, or historical block to read;
- block-watch scheduling, retries, cancellation, and stale-response handling;
- wallet connection, account sessions, chain switching, signing, submission,
  receipt tracking, and user-facing transaction state;
- keeper scheduling and private-key custody; and
- UI formatting and user-facing error presentation.

The distinction is that a consumer chooses *when and through which client* to
read or write, while the protocol package defines *what to read or write* and
how returned data is interpreted.

## Package Structure

The initial package will use focused public modules rather than a generic
utilities bucket:

```text
packages/protocol/
  package.json
  tsconfig.json
  src/
    index.ts
    amounts.ts
    market-params.ts
    market-state.ts
    morpho-reads.ts
    transaction-builders.ts
    abis/
      index.ts
      confidential-prize-pool.ts
      confidential-usdc.ts
      morpho-yield-adapter.ts
```

Files may be split further during planning if an existing ABI or read surface
would otherwise make a module difficult to review. Public exports remain
explicit; consumers must not depend on package-internal paths.

The package will be private and workspace-local. It will expose TypeScript
source through package exports so Next.js and Vite can compile it in the same
way as consumer source. The Next.js configuration will transpile
`@sortecerta/protocol`. Root scripts and package tests will exercise the shared
package directly.

## Official Morpho SDK Boundary

Use the currently compatible official packages as the implementation source:

- `@morpho-org/blue-sdk` for `MarketParams`, `Market`, `Position`, share
  conversions, accrued interest, utilization, health, and related math;
- `@morpho-org/blue-sdk-viem` for the Morpho Blue, adaptive-curve IRM, and
  oracle ABIs; and
- `@morpho-org/morpho-ts` only where required by the official package's public
  or peer interfaces.

The protocol package must not copy SDK formulas or standard Morpho ABIs. Thin
wrappers are acceptable when they enforce SorteCerta invariants or preserve a
stable local interface.

`sameMarketParams` is replaced by canonical identity comparison. Inputs are
converted to checksummed `MarketParams` instances and compared by their
official market IDs. This preserves the repository rule that every address
passed to SDK and relayer operations is checksummed.

The generic SDK fetchers will not own current Sepolia reads. The published
Morpho address registry does not provide this custom Sepolia deployment, and
registering custom addresses would introduce mutable global configuration.
Instead, SorteCerta keeps explicit deployment addresses and uses SDK entities,
math, and ABIs inside read functions that accept those addresses directly.

The high-level `@morpho-org/morpho-sdk` transaction layer is outside this
refactor. Adopting its bundler routing would change transaction behavior rather
than merely consolidate duplicate code.

## Market Decoding And Comparison

Custom `MorphoYieldAdapter.marketParams()` results still require a local
decoder because they are not an official Morpho fetcher result. The decoder
must:

- accept both positional tuples and named tuple objects returned by Viem;
- require all five fields instead of silently defaulting missing values;
- convert every address with `viem.getAddress()`;
- require bigint-compatible LLTV data; and
- return the official SDK `MarketParams` representation.

Equivalent strict decoders will cover market state and position tuples only
where the current consumers receive untyped custom data. A decoder must not
accept broader coercions merely to accommodate malformed fixtures.

## Pinned-Block Reads

Shared read functions receive a Viem-compatible public client, explicit
checksummed deployment addresses, and a `blockNumber`. Every `getBlock`,
`getBalance`, and `readContract` call made for that snapshot must include the
same block number.

For example, the reusable yield projection boundary will conceptually be:

```ts
readMorphoYieldSnapshot(client, addresses, blockNumber)
```

The web app remains responsible for selecting and watching `blockNumber`, and
for preventing an older asynchronous response from replacing newer UI state.
The lab may expose a convenience function that first obtains the latest block
and then delegates to the pinned shared reader, but the snapshot implementation
itself belongs to the protocol package.

Fallback behavior is preserved. If live projection inputs cannot be read, the
yield reader may return the pool's stored yield with an explicit source marker.
It must not combine values from different blocks.

## Transaction Builders And Wallet Boundary

Reusable builders return normalized Viem contract requests containing the
address, ABI, function name, arguments, and optional value. They validate
protocol invariants but do not simulate, sign, submit, or wait for receipts.

The web application's Web3Auth/wagmi session, the lab's direct MetaMask
provider, and the keepers' server-side account clients remain consumer-owned.
This avoids coupling the protocol package to React, browser globals, wallet
providers, or private-key handling while still removing duplicated calldata
and ABI definitions.

## Canonical Amount Parsing

Replace the web-only `parseUSDC` and lab-only `parseAmount` implementations
with one exported function:

```ts
parseAmount(input: string, decimals: number): bigint
```

The parser has these exact semantics:

- `decimals` is configurable and must be a non-negative integer;
- surrounding whitespace is trimmed;
- comma group separators are accepted when correctly grouped;
- a trailing decimal point is accepted;
- zero is accepted;
- negative values, signs, exponent notation, empty values, misplaced commas,
  multiple decimal points, non-digits, and excess fractional precision are
  rejected;
- accepted values are converted exactly and never rounded; and
- excess precision produces an error that names the allowed decimal count.

Representative accepted inputs include `"0"`, `" 1 "`, `"1."`,
`"1.000001"` at six decimals, and `"1,000.25"`. Representative rejected
inputs include `"-1"`, `"+1"`, `"1e3"`, `"1,2"`, `"12,34"`, `".5"`, and
`"1.0000001"` at six decimals.

Positivity is a separate operation constraint. Transaction builders or action
validators that require a positive amount continue to reject `amount <= 0n`
with the existing positive-amount error. This lets parsing represent zero
consistently while preserving the rule that zero-value writes are invalid.

`formatUSDC` and other presentation formatting remain outside the protocol
package unless a later duplication review finds identical formatting behavior.

## ABI Ownership

Standard Morpho ABIs are imported from `@morpho-org/blue-sdk-viem`; local
copies are removed after all consumers migrate.

SorteCerta-specific ABIs are exported from `@sortecerta/protocol`:

- `ConfidentialPrizePool` functions and events used by applications and
  keepers;
- `ConfidentialUSDC` functions and events used outside contract tests; and
- `MorphoYieldAdapter` functions and events.

The first migration covers web, Morpho lab, and Netlify/Node keeper code.
Hardhat deployment scripts migrate when the same readonly ABI export is
accepted by Ethers without conversion or loss of typing. If the script runtime
cannot consume the workspace TypeScript package safely, its migration is
deferred explicitly rather than adding a second build system to this refactor.

## Migration Strategy

Ownership moves in independently verifiable stages:

1. Add `@sortecerta/protocol`, canonical amount parsing, and tests.
2. Replace consumer market parameter types, decoding, and equality with the
   SDK-backed protocol exports.
3. Replace copied Morpho arithmetic with official SDK-backed calculations,
   retaining equivalence tests for current rounding and accrual behavior.
4. Move pinned Morpho read and yield projection primitives into the protocol
   package while retaining consumer refresh orchestration.
5. Replace standard Morpho ABIs with official exports and consolidate
   SorteCerta ABIs.
6. Migrate transaction request builders that are genuinely identical across
   consumers.
7. Remove the old implementations only after their consumers and equivalence
   tests pass.

Each stage must leave the repository buildable. Feature changes and protocol
behavior changes are outside the refactor.

## Error Handling

Protocol functions throw precise technical errors for invalid tuple shapes,
invalid addresses, unsupported numeric values, excess amount precision, and
violated action invariants. They do not translate errors into product copy.

Consumers remain responsible for mapping errors to UI messages, deciding when
a projected-yield failure should show stored data, and retaining form values
after failed wallet actions.

## Verification

Tests must establish behavior before deleting duplicated implementations:

- table-driven amount parsing tests cover all accepted and rejected forms,
  configurable decimals, zero, whitespace, commas, trailing decimal points,
  precision errors, and very large hostile inputs;
- tuple-decoder tests cover named and positional Viem results, malformed
  values, bigint handling, and checksum normalization;
- market-identity tests show equivalent checksummed/case-varied inputs produce
  the same official market ID and changed fields do not;
- arithmetic equivalence tests compare the official SDK-backed implementation
  with current fixtures, including rounding, fee shares, and zero-yield floors;
- read tests assert every request in a snapshot uses the requested block and
  preserve projected/stored fallback behavior;
- ABI surface tests assert every consumed function and event remains present;
- existing Morpho lab unit, typecheck, build, and EVM tests pass;
- existing web tests, typecheck, and production build pass;
- keeper tests pass; and
- contract compile/tests pass if deployment scripts or contract package imports
  change.

## Non-Goals

- Changing the Sepolia network or deployed addresses
- Registering global custom Morpho SDK addresses
- Migrating to the high-level Morpho transaction SDK
- Changing contract storage, Solidity interfaces, or deployed bytecode
- Changing wallet providers, account abstraction, keeper custody, or signing
- Redesigning UI copy or formatting
- Modifying generated lockfiles unrelated to dependencies required by this
  package
- General-purpose shared utilities unrelated to protocol integration

## Success Criteria

The refactor is complete when web, Morpho lab, and keepers consume one
protocol-owned implementation for shared Morpho types, decoding, comparison,
math, reads, relevant request builders, and ABIs; both applications use the
same `parseAmount` semantics; no migrated standard Morpho code is maintained
locally; and all verification gates pass without changing observed protocol or
wallet behavior.
