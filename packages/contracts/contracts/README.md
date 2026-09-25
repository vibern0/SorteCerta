# SorteCerta Contracts

SorteCerta's active contract path is the confidential prize-savings protocol
used for the Zama bounty demo on Ethereum Sepolia.

## Active Contracts

- `ConfidentialUSDC` wraps USDC as the ERC-7984 savings token.
- `ConfidentialPrizePool` owns principal accounting, draw lifecycle, FHE random
  weighted winner selection, prize crediting, claims, and withdrawal batches.
- `MorphoYieldAdapter` is the optional yield adapter owned by the pool.
- `MockUSDC` and `MockMorphoBlue` are local-test fixtures only.

## Deploy

```bash
npm run deploy:confidential-usdc
CONFIDENTIAL_USDC_ADDRESS=0x... npm run deploy:confidential-pool
CONFIDENTIAL_PRIZE_POOL_ADDRESS=0x... npm run deploy:morpho-yield-adapter
```

The removed plaintext `Vault`, plaintext `PrizePool`, and primitive spike were
prototype scaffolding. See `docs/BOUNTY_SCOPE.md` and `docs/ROADMAP.md` for the
architecture constraints that replaced them.
