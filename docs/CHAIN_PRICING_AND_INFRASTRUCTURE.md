# Chain Pricing and Infrastructure

Research date: September 29, 2026. Internal product-launch planning, not user-facing copy.

The bounty has finished; this comparison supports the planned public product launch.
It compares Ethereum mainnet, Polygon PoS, and HyperEVM without changing deployment
configuration or selecting a new production network. The historical bounty scope
remains in [BOUNTY_SCOPE.md](BOUNTY_SCOPE.md). Existing launch controls remain in
[ROAD_TO_MAINNET.md](ROAD_TO_MAINNET.md).

## Findings

- Ethereum has the most complete verified Zama yield integration of these choices,
  but sponsoring frequent user transactions can be expensive.
- Polygon has Zama FHE infrastructure and a native-USDC confidential wrapper, plus
  standard Morpho infrastructure. Zama's ready-made confidential Morpho vaults and
  their batchers were not found on Polygon in the registry checked below.
- HyperEVM has the lowest gas cost in this snapshot, but the Zama deployments found
  there are token/bridge infrastructure. FHE support required by SorteCerta is
  unverified; the presence of the ZAMA token does not establish that support.
- Polygon merits a feasibility investigation. Lower execution fees must be weighed
  against implementing and auditing a yield integration. This is not a migration
  decision, and no end-to-end mainnet flow was tested for this document.

## Infrastructure by chain

| Capability | Ethereum | Polygon PoS | HyperEVM |
| --- | --- | --- | --- |
| Chain ID / gas token | 1 / ETH | 137 / POL | 999 / HYPE |
| Zama FHE executor, ACL and verifiers | Listed | Listed | Not found in checked registry |
| Zama confidential USDC wrapper | Listed | Listed; underlying is native Polygon USDC | Not found in checked registry |
| Standard Morpho infrastructure | Listed | Listed | Listed |
| Zama confidential Morpho vaults and settlement batchers | Listed | Not found in checked registry | Not found in checked registry |
| Main integration work | Validate vault access, pool accounting and asynchronous settlement | Select a viable USDC yield source and adapt/build settlement | First establish supported Zama FHE infrastructure |

Zama evidence is pinned to
[registry commit 0084a97](https://github.com/zama-ai/protocol-registry/blob/0084a97b5323049e601b77d398339a020742ccc3/mainnet.json).
Polygon entries include `POLYGON_FHEVM_EXECUTOR`, `POLYGON_ACL_HOST`,
`POLYGON_INPUT_VERIFIER`, `POLYGON_KMS_VERIFIER`, and `POLYGON_CONFIDENTIAL_USDC`.
HyperEVM entries include `ZAMA_OFT_HYPEREVM` and `HYPERLIQUID_COMPOSER`.
The yield vault and vault-batcher entries checked are on Ethereum.
Registry presence is evidence of a published deployment, not proof of operational
readiness, application access, liquidity, or compatibility with our SDK version.

[Morpho's address directory](https://docs.morpho.org/developers/contracts/addresses/)
and [supported API networks](https://docs.morpho.org/developers/api/get-started/)
cover all three chains. Protocol deployment alone does not establish a suitable
USDC vault, sustainable yield, sufficient withdrawal liquidity, or identical
integration features across chains.

### Ethereum

Zama's [September 15 expansion](https://www.zama.org/post/confidential-defi-at-scale)
and [vault product](https://www.zama.org/confidential-vaults) provide an existing
route into curated Morpho strategies. SorteCerta still needs to prove that route
with its own principal liabilities, prize accounting, and withdrawal flow.

The existing [vault integration research](FUTURE_VAULT_INTEGRATION.md) compares a
standard ERC-4626 adapter with Zama's gateway/batchers. Existing integrations do
not remove our audit, keeper, reconciliation, or liquidity obligations.

### Polygon PoS

A candidate design keeps individual accounting and draws in Zama while the pool
invests aggregated USDC through standard Morpho infrastructure on Polygon.
This requires selecting an actual vault/market and proving the unwrap, supply,
yield realization, redemption, rewrap, and withdrawal paths.

The aggregate investment would be visible. Batching does not automatically hide
individual amounts: single-user batches, timing, and correlated transfers can
reveal them. Evaluate those disclosures before claiming equivalent privacy.
Settlement and custody rules need review, including loss handling and preventing
principal or pending withdrawal backing from being distributed as prizes.

This same-chain candidate avoids a bridge to Ethereum. Using Ethereum's Zama
vaults from Polygon would instead introduce bridging costs, delays, liquidity
requirements, and additional security assumptions; the gas table below does not
price that architecture.

### HyperEVM

[Zama's token documentation](https://github.com/zama-ai/protocol-apps/blob/main/docs/zama-token.md)
describes the ZAMA token's LayerZero bridge and HyperCore connection. These are
different capabilities from executing FHE contracts and decrypting user balances.
Before considering SorteCerta here, obtain official host-chain deployment and
relayer/SDK support evidence, then run the complete required FHE lifecycle.

## Gas price snapshot

These are observations from the September 29 discussion, approximately
19:02-19:07 UTC, not current quotes at the time someone reads this document.
USD prices were returned by the session's market-data tool for ETH, POL and HYPE;
no exchange-specific execution quote or historical price feed is archived here.
The explicit inputs make the arithmetic reproducible, not the original quotes.

| Input | Ethereum | Polygon PoS | HyperEVM |
| --- | --- | --- | --- |
| Native token price, USD | 2694.88 | 0.117818 | 86.63 |
| Gas price used, gwei | 1.802531622 | 295.800798311 | 0.1 |
| Source | PublicNode `eth_gasPrice` | Polygon Gas Station estimated base + standard priority fee | Official RPC `eth_gasPrice` |

Observed responses:

- [Ethereum PublicNode](https://ethereum-rpc.publicnode.com): `eth_gasPrice`
  returned `0x6b707326` (1,802,531,622 wei); `eth_chainId` returned `0x1`.
- [Polygon Gas Station](https://gasstation.polygon.technology/v2): block 94669087;
  estimated base fee 249.030084925 gwei plus standard priority fee
  46.770713386 gwei. Its standard maximum fee was 420.315840773 gwei; that
  ceiling is not the assumed effective price in this calculation.
- [HyperEVM official RPC](https://rpc.hyperliquid.xyz/evm): `eth_gasPrice`
  returned `0x5f5e100` (100,000,000 wei); `eth_chainId` returned `0x3e7`.

RPC gas suggestions and Polygon's estimated base-plus-tip are indicative prices,
not confirmed transaction receipt prices or guarantees of inclusion. Gas prices
and native token prices change independently. Refresh both before budgeting.

## Five transactions per user per month

Assume five successful onchain transactions per active user each month, all paid
by SorteCerta. These are scenarios, not measured SorteCerta gas consumption.
An approval, wrap, deposit, claim, or smart-account operation can have a different
cost. One UI action can require multiple transactions; an offchain signature is
not itself a host-chain transaction. Include smart-account/bundler overhead when
measuring the eventual flow.

```text
transaction_usd = gas_used * gas_price_gwei * 10^-9 * native_token_usd
user_month_usd = 5 * transaction_usd
sponsored_month_usd = active_users * user_month_usd * sponsored_fraction
```

At 250,000 gas per transaction:

| Network | USD / transaction | USD / user / month | USD / 1,000 users / month | USD / 10,000 users / month |
| --- | --- | --- | --- | --- |
| Ethereum | 1.2144 | 6.0720 | 6072.01 | 60720.08 |
| Polygon PoS | 0.008713 | 0.043563 | 43.56 | 435.63 |
| HyperEVM | 0.002166 | 0.010829 | 10.83 | 108.29 |

Monthly USD per user at other average gas consumption levels:

| Average gas / transaction | Ethereum | Polygon PoS | HyperEVM |
| --- | --- | --- | --- |
| 100,000 | 2.4288 | 0.017425 | 0.004332 |
| 250,000 | 6.0720 | 0.043563 | 0.010829 |
| 500,000 | 12.1440 | 0.087127 | 0.021658 |
| 1,000,000 | 24.2880 | 0.174253 | 0.043315 |

Totals use unrounded inputs. Holding everything else constant, a 10x gas price
produces a 10x gas bill. Equal gas consumption across chains is an illustrative
comparison; estimate and measure each deployment independently.

## Costs outside the gas table

| Cost | Treatment for all three chains |
| --- | --- |
| Cloudflare frontend and workers | Workers Paid starts at USD 5/month; static asset requests are free. CPU, storage, queues and other services can add usage charges. This is not a quote for the complete application. |
| RPC, wallet, bundler and signing services | Check supported networks, rate limits, production plans and provider fees. Public RPC endpoints above are measurement sources, not a production availability plan. |
| Zama protocol / relayer | Budget input verification and decryption separately from host-chain gas. Applicable rates, plans and sponsorship are unverified. |
| Shared protocol transactions | Add draw closing, yield routing/harvesting and withdrawal batches; these are outside the five user transactions. Cost depends on participants, batch sizes and cadence. |
| Retries and failures | Include gas consumed by reverted transactions and any paid service attempts. |
| Yield source fees | Use yield after vault/curator fees when estimating prize and operator revenue. Idle withdrawal reserves reduce earning capital. |
| Bridging / onboarding | Add only if the chosen flow requires them; not included in this comparison. |
| Audit and launch work | Separate from monthly hosting: obtain quotes for the actual contract/integration scope, legal review and later material changes. |
| Maintenance and support | Founder time, incident response and customer acquisition are not included in the gas scenario. |

[Cloudflare pricing](https://developers.cloudflare.com/workers/platform/pricing/)
supports the hosting baseline.
[Zama's published fee model](https://docs.zama.org/protocol/zama-protocol-litepaper)
describes verification and decryption charges separately from FHE computation.
Its initial price ranges are not a verified production quote for SorteCerta.
Changing the host chain does not establish that those service charges disappear.

If users pay their own fees, remove those fees from SorteCerta's cash expenses,
but retain them when evaluating the user's economics. If SorteCerta sponsors
them, apply the sponsored fraction and budget the shared operations separately.
Recurring cash break-even also differs from recovering audit costs or paying
the founder.

## Evidence needed before choosing a launch chain

1. Confirm exact Zama host contracts, SDK/relayer access, service fees and support
   for encryption, weighted draws, user decryption and settlement proofs.
2. Verify the canonical USDC and wrapper, then select a yield vault/market with
   adequate liquidity, understood fees, access rules and risk parameters.
3. Measure gas per actual operation, including smart-account overhead, retries,
   participant growth and several batch sizes. Record receipts and block numbers.
4. Refresh USD and gas quotes with UTC timestamps. For Ethereum/HyperEVM use
   `eth_chainId`, `eth_gasPrice` and `eth_feeHistory`; for Polygon retain the
   Gas Station response and distinguish maximum fees from estimated paid fees.
5. Price shared automation and Zama services, then test low/high activity and
   congestion scenarios. Confirm that fee revenue covers the selected budget
   without spending user principal or committed prizes.
6. Compare incremental development and audit costs with gas savings. Exercise
   deposit, draw, claim, full withdrawal, insufficient liquidity and recovery
   before updating the network plan or authorizing deployment.
