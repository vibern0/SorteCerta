# SorteCerta

> A sua poupança, com sorte. Versão de teste na Ethereum Sepolia.

Mobile-first confidential prize-savings app for the Zama Developer Program
Mainnet Season 4 bounty. SorteCerta recreates the core PoolTogether no-loss
mechanic on Ethereum Sepolia using Zama FHE; it does not integrate with the
official PoolTogether protocol.

> [!IMPORTANT]
> Current contracts are a plaintext lifecycle prototype. They do not yet meet
> the bounty requirements for encrypted balances, FHE randomness, confidential
> winnings, or EIP-712 user decryption. See
> [Bounty Scope and Architecture Decision](docs/BOUNTY_SCOPE.md) and the
> [Bounty Roadmap](docs/ROADMAP.md).

**What's in the box**

- **Web3 abstraction** — Social login (Google, Apple) via Web3Auth → derived
  EOA → Safe smart account (ERC-4337, EntryPoint v0.7).
- **Gasless** — Pimlico as bundler + paymaster. Users never see a gas popup.
- **Fiat on-ramp** — out of scope for this MVP. Add Onramper / Wert / Stripe
  ramp integration when going past testnet.
- **No-loss** — Users can always `vault.redeem(shares, …)` for their full
  principal. Prizes are funded by `fundPrizePool` (sponsor stand-in) until a
  real yield source is plugged in.
- **Mobile-first PWA** — Next.js 14, Tailwind, dark theme, no crypto jargon in
  the UI ("Poupar", "Bilhetes", "Sorteio", "Levantar").

## Repo layout

```
sortecerta/
  packages/
    contracts/   # Hardhat — MockUSDC, Vault (ERC4626), PrizePool
    web/         # Next.js 14 PWA — web3auth + permissionless + Safe + Pimlico
  package.json   # npm workspaces root
```

## Quick start

```bash
# 1. Install everything (workspaces).
npm install

# 2. Deploy contracts to Sepolia.
cd packages/contracts
cp .env.example .env  # fill PRIVATE_KEY + SEPOLIA_RPC_URL
npm run deploy:sepolia
# → prints USDC, Vault, PrizePool addresses

# 3. Configure the web app.
cd ../web
cp .env.example .env.local
# fill NEXT_PUBLIC_USDC_ADDRESS, NEXT_PUBLIC_VAULT_ADDRESS,
#       NEXT_PUBLIC_PRIZE_POOL_ADDRESS,
#       NEXT_PUBLIC_WEB3AUTH_CLIENT_ID, NEXT_PUBLIC_PIMLICO_API_KEY

# 4. Run.
npm run dev
# → http://localhost:3000
```

## Test the contracts

```bash
cd packages/contracts
npm test
```

10 tests covering deposit, withdrawal (no-loss), draw lifecycle, weighted
randomness, edge cases.

## Architecture

### Bounty target

- **Network:** Ethereum Sepolia only.
- **Token:** Circle's official Sepolia USDC
  (`0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`) plus an ERC-7984 confidential
  wrapper. `MockUSDC` remains only for local Hardhat tests.
- **Accounting:** individual deposits, balances, shares, and winnings encrypted
  onchain.
- **Draw:** deposit-weighted winner selection over encrypted balances using
  Zama FHE randomness. No offchain RNG and no plaintext balance calculation.
- **Claim/decryption:** winner-only confidential prize flow plus Zama EIP-712
  user decryption.
- **Yield:** documented admin-funded prize reserve is acceptable for Sepolia.
- **PoolTogether:** mechanic reference only; no official protocol dependency.

Current prototype architecture:

```
                        ┌─────────────────────┐
                        │      Web3Auth       │
                        │  (Google / Apple)   │
                        └──────────┬──────────┘
                                   │ MPC → EOA private key
                                   ▼
                        ┌─────────────────────┐
                        │   Safe smart acct   │ ← permissionless + viem
                        │  (ERC-4337, EP 0.7) │
                        └──────────┬──────────┘
                                   │ signed UserOp
                                   ▼
                        ┌─────────────────────┐
                        │       Pimlico       │ ← bundler + paymaster
                        └──────────┬──────────┘
                                   │ sponsored tx
                                   ▼
        ┌──────────────────────────────────────────────────┐
        │                  Ethereum Sepolia                │
        │                                                  │
        │   MockUSDC ──► Vault (ERC4626) ──► PrizePool    │
        │                   │                  │           │
        │                   │ shares           │ draws     │
        │                   ▼                  ▼           │
        │               user balance      winner pick     │
        └──────────────────────────────────────────────────┘
```

## Current prototype gaps

This is a **plaintext scaffold**, not a bounty-ready implementation:

- **Confidential principal lifecycle is in progress.** `ConfidentialUSDC`
  wraps USDC as ERC-7984, and `ConfidentialPrizePool` now supports encrypted
  deposits plus encrypted-amount withdrawals for principal. Draws and prize
  claims are still not wired into this confidential pool.

- **Randomness** uses `blockhash`. Replace it with Zama FHE randomness and run
  deposit-weighted winner selection over encrypted balances.
- **Confidentiality** is not implemented. Replace plaintext vault shares,
  deposits, and winnings with ERC-7984 or encrypted-integer accounting.
- **User decryption** is not implemented. Add Zama SDK/relayer EIP-712 flows for
  connected-wallet balance and winnings decryption.
- **Zama SDK address handling** must preserve checksum addresses. The Phase 1
  spike showed lowercase/non-checksum addresses can fail SDK validation with
  `User address is not a valid address`. Normalize user and contract addresses
  with `viem.getAddress()` before `createEncryptedInput`, `createEIP712`, and
  `userDecrypt`.
- **Zama EIP-712 serialization** needs a `bigint` replacer before
  `eth_signTypedData_v4`; plain `JSON.stringify` can throw
  `Do not know how to serialize a BigInt`.
- **Yield source** is `fundPrizePool` (sponsor-funded). Plug in Aave / Morpho
  / Superlend to make the prize pool self-sustaining.
- **Tickets = live share balance**. Should be a snapshot at draw start to
  prevent last-minute deposit/withdraw manipulation.
- **USDC** is a mock. A test ERC-20 is acceptable for this bounty; document its
  faucet and confidential wrapping/deposit flow.
- **Fiat on-ramp** is out of scope for this MVP. Add MB Way via Onramper or
  Stripe's on-ramp.
- **Legal** — "no-loss lottery" lives in a grey zone in PT (SRIJ) and EU. Get
  legal sign-off before any mainnet or marketing.

## Where to go from here

1. Replace the plaintext prototype with Zama confidential accounting and FHE
   draw logic.
2. Implement EIP-712 user decryption and the full deposit, draw, claim, and
   withdraw frontend cycle.
3. Test locally, then deploy and verify the complete demo on Ethereum Sepolia.
4. Document leakage, mock yield, faucet, keeper flow, and deployed addresses.
5. Record the real-person demo and publish the X thread/article.
