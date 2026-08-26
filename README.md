# SorteCerta

> Your savings, with a chance to win. Test version on Ethereum Sepolia.

Mobile-first confidential prize-savings app for the Zama Developer Program
Mainnet Season 4 bounty. SorteCerta recreates the core PoolTogether no-loss
mechanic on Ethereum Sepolia using Zama FHE; it does not integrate with the
official PoolTogether protocol.

> [!IMPORTANT]
> The confidential implementation is now the bounty path. `ConfidentialUSDC`
> wraps USDC as an ERC-7984 confidential token, and
> `ConfidentialPrizePool` handles encrypted deposits, encrypted principal,
> FHE-random weighted draws, confidential winnings, claiming, and encrypted
> withdrawals. The old plaintext `Vault` / `PrizePool` remains only as prototype
> history and local comparison scaffolding. See
> [Bounty Scope and Architecture Decision](docs/BOUNTY_SCOPE.md) and the
> [Bounty Roadmap](docs/ROADMAP.md).

**What's in the box**

- **Web3 abstraction** — Social login (Google, Apple) via Web3Auth → Safe smart
  account (ERC-4337, EntryPoint v0.7).
- **Gasless** — Pimlico as bundler + paymaster. Users never see a gas popup.
- **Fiat on-ramp** — out of scope for this MVP. Add Onramper / Wert / Stripe
  ramp integration when going past testnet.
- **No-loss** — Users can withdraw encrypted principal from
  `ConfidentialPrizePool` and unwrap it back to USDC. Prizes are funded by a
  sponsor-funded confidential reserve until a real yield source is plugged in.
- **Mobile-first PWA** — Next.js 14, Tailwind, dark theme, no crypto jargon in
  the UI ("Save", "Tickets", "Draw", "Withdraw").

## Repo layout

```
sortecerta/
  packages/
    contracts/   # Hardhat — ConfidentialUSDC, ConfidentialPrizePool, mocks
    web/         # Next.js 14 PWA — Web3Auth + Safe + Pimlico + Zama relayer
  package.json   # npm workspaces root
```

## Quick start

```bash
# 1. Install everything (workspaces).
npm install

# 2. Deploy confidential contracts to Sepolia.
cd packages/contracts
cp .env.example .env  # fill PRIVATE_KEY + SEPOLIA_RPC_URL
npm run deploy:confidential-usdc
# -> prints Circle Sepolia USDC + ConfidentialUSDC addresses
CONFIDENTIAL_USDC_ADDRESS=0x... npm run deploy:confidential-pool
# -> prints ConfidentialPrizePool address

# 3. Configure the web app.
cd ../web
cp .env.example .env.local
# fill NEXT_PUBLIC_USDC_ADDRESS, NEXT_PUBLIC_CONFIDENTIAL_USDC_ADDRESS,
#       NEXT_PUBLIC_CONFIDENTIAL_PRIZE_POOL_ADDRESS,
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

25 tests covering confidential deposits, encrypted principal decryption,
withdrawal/unwrap, encrypted prize funding, FHE-random draws, confidential
claims, and the old plaintext prototype.

## Sepolia deployment

Current confidential deployment:

- **USDC underlying:** `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`
- **ConfidentialUSDC:** `0xb6324F328326d1a1DE86286a606774E16D5e7A06`
- **ConfidentialPrizePool:** `0x4A1dF33C5b570A1A82cB5CE487b29c2BE7710520`
- **Chain:** Ethereum Sepolia (`11155111`)
- **Draw interval:** `300` seconds for demo testing

Frontend env values:

```bash
NEXT_PUBLIC_USDC_ADDRESS=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
NEXT_PUBLIC_CONFIDENTIAL_USDC_ADDRESS=0xb6324F328326d1a1DE86286a606774E16D5e7A06
NEXT_PUBLIC_CONFIDENTIAL_PRIZE_POOL_ADDRESS=0x4A1dF33C5b570A1A82cB5CE487b29c2BE7710520
NEXT_PUBLIC_CHAIN_ID=11155111
```

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

Current confidential architecture:

```
                        ┌─────────────────────┐
                        │      Web3Auth       │
                        │  (Google / Apple)   │
                        └──────────┬──────────┘
                                   │ owner signer
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
        │  USDC ──► ConfidentialUSDC ──► ConfidentialPrizePool │
        │             ERC-7984 cUSDC          │                │
        │                   │                 │ FHE draw       │
        │                   ▼                 ▼                │
        │          encrypted balances   private winnings       │
        └──────────────────────────────────────────────────┘
```

## Current implementation status

- **Confidential lifecycle is in progress and is the active bounty
  implementation.** `ConfidentialUSDC` wraps USDC as ERC-7984, and
  `ConfidentialPrizePool` supports encrypted deposits, encrypted-amount
  withdrawals, encrypted prize reserve funding, encrypted winnings, claim, and
  Zama EIP-712 user decryption from the frontend.
- **Draw MVP uses a public power-of-two ticket cap.** `closeDraw` uses
  `FHE.randEuint64(MAX_DRAW_TICKETS)` and encrypted cumulative principal ranges.
  When encrypted total principal equals the cap, selection is exactly
  deposit-weighted. If total principal is below the cap, the unoccupied ticket
  range has no winner and the encrypted prize carries forward. This avoids
  plaintext total-balance disclosure because Zama's bounded random API requires
  a public power-of-two upper bound.
- **Zama SDK address handling** must preserve checksum addresses. The Phase 1
  spike showed lowercase/non-checksum addresses can fail SDK validation with
  `User address is not a valid address`. Normalize user and contract addresses
  with `viem.getAddress()` before `createEncryptedInput`, `createEIP712`, and
  `userDecrypt`.
- **Zama EIP-712 serialization** needs bigint-safe handling before typed-data
  signing; plain `JSON.stringify` can throw
  `Do not know how to serialize a BigInt`.
- **Yield source** is a sponsor-funded prize reserve. A sponsor wraps USDC to
  cUSDC and sends it to `ConfidentialPrizePool` with `PRIZE_FUNDING_DATA`. Plug
  in Aave / Morpho / Superlend only after the Sepolia bounty demo is stable.
- **Tickets = live share balance**. Should be a snapshot at draw start to
  prevent last-minute deposit/withdraw manipulation.
- **USDC** uses Circle Sepolia USDC for deployment when practical, with
  `MockUSDC` kept for local Hardhat tests and fallback demos.
- **Fiat on-ramp** is out of scope for this MVP. Add MB Way via Onramper or
  Stripe's on-ramp.
- **Legal** — "no-loss lottery" lives in a grey zone in PT (SRIJ) and EU. Get
  legal sign-off before any mainnet or marketing.

## Where to go from here

1. Finish the judge-facing confidential frontend: faucet/onboarding, prize
   funding, close draw, decrypt winnings, claim, withdraw, and unwrap.
2. Deploy `ConfidentialUSDC` and `ConfidentialPrizePool` to Ethereum Sepolia.
3. Run a clean-browser, multi-wallet Sepolia test of deposit, decrypt, fund,
   close, claim, withdraw, and finalize unwrap.
4. Document leakage, sponsor-funded mock yield, faucet, keeper flow, and
   deployed addresses.
5. Record the real-person demo and publish the X thread/article.
