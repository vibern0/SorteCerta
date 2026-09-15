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
pool to unwrap the pending principal to the Morpho adapter. On a later run, the
keeper discovers that request from wrapper events, obtains Zama's public
decryption proof, and finalizes the unwrap. Once the adapter has USDC, the keeper
supplies it to Morpho. Idle runs update Morpho's lazy interest accounting; when
yield becomes observable, the keeper harvests it into the prize reserve.

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
state and executes at most one transaction, continuing the state machine on the
next five-minute run:

1. supply finalized adapter USDC to Morpho;
2. harvest available Morpho yield into the prize reserve;
3. finalize the oldest ready Morpho-bound unwrap;
4. request a timed unwrap for pending pool principal;
5. accrue Morpho interest when no higher-priority work is pending.

The keeper scans from `MORPHO_KEEPER_START_BLOCK` (the wrapper deployment block)
to the latest block in exact 10,000-block chunks for wrapper requests and matching
finalizations. This prevents a delayed request from aging out of discovery. A
temporarily unavailable Zama public-decryption proof leaves the request pending
for the next scheduled run instead of submitting a transaction.

`MORPHO_KEEPER_MAX_TXS` is retained for configuration compatibility, but the
scheduled runtime hard-caps every run to one transaction to stay inside Netlify's
execution limit. Set `MORPHO_KEEPER_START_BLOCK` to the new wrapper deployment
block whenever the contracts are redeployed.
