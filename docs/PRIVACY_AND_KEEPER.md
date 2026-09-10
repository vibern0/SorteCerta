# Privacy and Keeper Notes

SorteCerta is in an early experimental phase. The current production guardrail is
a `1,000 USDC` principal limit per account, enforced by `ConfidentialPrizePool`
and mirrored in the deposit UI.

## Morpho keeper cadence

User deposits enter the pool as confidential `cUSDC`. The pool does not send each
deposit directly to Morpho. Instead, deposits accumulate in an encrypted pending
principal bucket.

A keeper runs on a fixed cadence, currently intended to be every five minutes.
When the interval has elapsed and there has been deposit activity, it asks the
pool to unwrap the pending principal to the Morpho adapter. After the unwrap is
finalized and the adapter has public USDC, the keeper supplies that available
USDC to Morpho. On later runs, if Morpho yield is available, the keeper harvests
that yield back into the prize reserve.

## Known privacy tradeoffs

The five-minute keeper cadence intentionally trades some privacy for a smoother
first-phase product:

- Observers can see that an unwrap happened for a time window.
- The finalized unwrap amount is public.
- Harvested yield and the active prize amount are public.
- Deposit transaction timing and participant addresses are visible.
- Individual pool principal and winnings remain encrypted.

This is better for liveness than waiting for a fixed number of deposits, but it
does reveal activity at the cadence boundary. Later versions can improve this
with longer or randomized windows, minimum batch thresholds, decoy liquidity,
separate liquidity buffers, and more careful keeper scheduling.

## Keeper safety

The Netlify keeper is intentionally idempotent. Each run reads current onchain
state and can execute a bounded number of actions:

1. supply finalized adapter USDC to Morpho;
2. harvest available Morpho yield into the prize reserve;
3. request a timed unwrap for pending pool principal.

`MORPHO_KEEPER_MAX_TXS` controls how many transactions one scheduled run may
send. It defaults to `3` and is capped in code to avoid unbounded nonce, gas, or
timeout behavior.
