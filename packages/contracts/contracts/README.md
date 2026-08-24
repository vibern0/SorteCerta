# SorteCerta — Smart Contracts

PoolTogether-style no-loss lottery, simplified for an early prototype on Ethereum Sepolia.

> **Bounty status:** these contracts use plaintext ERC-4626 balances and are not
> the final Zama bounty architecture. Official PoolTogether integration is not
> required. The target is SorteCerta's own confidential prize-savings protocol
> on Ethereum Sepolia. Read [`../../../docs/BOUNTY_SCOPE.md`](../../../docs/BOUNTY_SCOPE.md)
> before changing the contract architecture.

## Architecture

```
User
  │  depositAndBuyTickets(USDC)
  ▼
PrizePool ──► Vault (ERC4626) ──► USDC
  │             │
  │             └── shares (= tickets) back to user
  │
  ├── fundPrizePool(USDC) [anyone — stand-in for yield]
  │
  └── closeDraw() after interval
        ├── blockhash random → winner
        └── pay USDC prize to winner
```

- **No-loss guarantee**: users can always call `vault.redeem(shares, …)` to get their USDC back. The Vault holds 1:1.
- **Prize funding**: MVP doesn't plug in a real yield source. Anyone calls `fundPrizePool(amount)` to add USDC to the active draw's prize.
- **Randomness**: `blockhash(block.number - 1)`. **Prototype-only** — the bounty
  implementation must use Zama FHE randomness such as `FHE.randEuint` and
  deposit-weighted selection over encrypted balances.
- **Confidentiality**: not implemented in this prototype. The bounty target must
  use ERC-7984 or encrypted-integer accounting and EIP-712 user decryption.

## Contracts

- `MockUSDC` — 6-decimal ERC20 with public faucet.
- `Vault` — ERC4626 share-accounting wrapper. Shares = tickets.
- `PrizePool` — draw lifecycle, deposits, prize funding, winner selection.

## Setup

```bash
npm install
cp .env.example .env
# fill PRIVATE_KEY (testnet-only!), SEPOLIA_RPC_URL
```

## Test

```bash
npm run test
```

Covers: deposit, withdraw, ticket accounting, draw lifecycle, weighted winner selection, edge cases.

## Deploy to Sepolia

```bash
# 1. Get testnet ETH for the deployer (https://sepoliafaucet.com/)
# 2. Optionally override the draw interval:
DRAW_INTERVAL_SECONDS=86400 npm run deploy:sepolia
```

After deploy, the script prints the addresses. Set them as `NEXT_PUBLIC_*` env vars in the web app.

## Bootstrap the first draw

```ts
const usdc = await ethers.getContractAt("MockUSDC", USDC_ADDR);
const pool = await ethers.getContractAt("PrizePool", POOL_ADDR);

await usdc.faucet(deployer.address, 1_000_000_000n); // 1000 USDC
await usdc.approve(pool, 1_000_000_000n);
await pool.fundPrizePool(1_000_000_000n); // 1000 USDC prize for draw #1
```
