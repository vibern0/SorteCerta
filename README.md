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
  `ConfidentialPrizePool` and unwrap it back to USDC. The visible global prize
  is currently mocked by sponsor/admin funding until a real yield source is
  plugged in.
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
withdrawal/unwrap, public mocked prize funding, FHE-random draws, confidential
claims, and the old plaintext prototype.

## Sepolia deployment

Current confidential deployment:

- **USDC underlying:** `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`
- **ConfidentialUSDC:** `0x47E6c485506C6b1F97872028f127a2943B5559c3`
- **ConfidentialPrizePool:** `0x1A31302BDEF9f21E897dbe1c32BDCE90b68B8085`
- **Chain:** Ethereum Sepolia (`11155111`)
- **Draw interval:** `300` seconds for demo testing

Frontend env values:

```bash
NEXT_PUBLIC_USDC_ADDRESS=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
NEXT_PUBLIC_CONFIDENTIAL_USDC_ADDRESS=0x47E6c485506C6b1F97872028f127a2943B5559c3
NEXT_PUBLIC_CONFIDENTIAL_PRIZE_POOL_ADDRESS=0x1A31302BDEF9f21E897dbe1c32BDCE90b68B8085
NEXT_PUBLIC_CHAIN_ID=11155111
```

### Example Sepolia run

The deployed pool has been exercised end to end on Sepolia with real wrapped
USDC deposits, sponsor-funded prizes, round closes, prize claims, and a USDC
withdrawal request. As of August 26, 2026, the pool had closed 8 rounds, started
round 9, and registered 1 participant:
`0x8AEFBA26724c9FD9a1f06E3a65bfd7a8004d2F79`.

Useful example transactions:

- Initial zero-prize close for round 1:
  `0x467a5b4fbef7ad249c915a1619babd5fd1b7ff2ba17a9893fa8552e50e9e724b`
- Prize funding of `1.000000` USDC for round 2:
  `0xc6b2d346173cffc926cc0b88872eaf2be934a54d861ff264026aa8357622d348`
- Second prize funding of `1.000000` USDC for round 2:
  `0xb8f6452f178868186a612813bf69af595f953ccbe9833ad91bfbc6684070c315`
- Round 2 close over the funded prize reserve:
  `0x9cc90c2e47644068f128f568c74dba119e41186d74ae06d6dbd50e9686d80be6`
- Deposit with decrypt delegate update:
  `0xda63b1918d1a022db8bc8fc506b62c434e05bc0f81b6f8263b270f79fe775368`
- Prize claim after a later round:
  `0x322964721c739ba894ea8fb98a70c33782562c3e911f736543535213bfdd52a7`
- USDC withdrawal request:
  `0xc1a105950198e87adb5d43d998a44444e227d30bd430dd0675cf2b74a0948bd0`
- Round 8 close and round 9 start:
  `0xf3ee88144c386ae78bae23e44181dbb03972645bfeacb3864dce57865f4c7478`
- Prize claim after round 8:
  `0xe9028ea4edc3caafc5a70d3f78fa2b95a75497c78faaa3b4b600fddb9048f7d9`

Explorer links use the Sepolia Etherscan transaction URL format:
`https://sepolia.etherscan.io/tx/<hash>`.

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
- **Prize/yield:** the global prize amount is public for UX. It is currently
  mocked by sponsor/admin funding on Sepolia; Aave/Morpho/Superlend-style yield
  can replace that funding source later.
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

### ConfidentialPrizePool contract analysis

`ConfidentialPrizePool` is the active bounty contract at
`packages/contracts/contracts/ConfidentialPrizePool.sol`.

- Deposits arrive through `ConfidentialUSDC.confidentialTransferAndCall`.
  Normal transfer callbacks increase the sender's encrypted principal and the
  encrypted total principal, then grant decrypt access to the account and its
  optional delegate.
- Prize funding uses callback data prefixed with `PRIZE_FUNDING_DATA`. The
  encrypted cUSDC reserve is held by the pool, while the same amount is mirrored
  in `publicPrizeReserve` so the app can show the active prize.
- Draw closing is permissionless once `nextDrawAt` has passed. The contract
  draws `FHE.randEuint64(MAX_DRAW_TICKETS)` and scans the bounded participant
  list using encrypted cumulative balances.
- Winner credit is private. Each participant's encrypted winnings are updated
  with `FHE.select`, and only that account or its decrypt delegate receives
  decrypt access.
- Claims transfer encrypted cUSDC winnings to the caller and reset their
  encrypted winnings handle.
- Withdrawals accept an encrypted requested amount, cap it with
  `FHE.min(requested, principal)`, reduce encrypted principal, and either return
  cUSDC or create an underlying USDC unwrap request.
- The no-loss invariant is principal-backed by pool-held cUSDC. Prize funds sit
  in the separate encrypted prize reserve and are not consumed by withdrawal.

Important current limitations:

- `MAX_PARTICIPANTS` is 32, which is appropriate for the Sepolia FHE demo but
  not a scalable production participant set.
- Draw eligibility uses live balances at close time. The next hardening step is
  a draw-start snapshot so late deposits or withdrawals cannot affect the same
  round's odds.
- The random ticket upper bound is the public power-of-two
  `MAX_DRAW_TICKETS = 1_048_576`. If encrypted total principal is below that
  cap, the unoccupied range creates a no-winner outcome and carries the
  encrypted prize forward. That avoids disclosing total principal to compute a
  tighter random bound.
- Participant addresses, participant count, transaction timing, draw timing,
  public prize funding amounts, and the configured draw interval are visible.
  Individual principal, total principal, random ticket, prize credit, and
  winnings remain encrypted.

## Current implementation status

- **Confidential lifecycle is in progress and is the active bounty
  implementation.** `ConfidentialUSDC` wraps USDC as ERC-7984, and
  `ConfidentialPrizePool` supports encrypted deposits, encrypted-amount
  withdrawals, public mocked prize funding, encrypted winnings, claim, and
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
- **Yield source** is mocked. A sponsor wraps USDC to cUSDC and sends it to
  `ConfidentialPrizePool` with `PRIZE_FUNDING_DATA`; the sponsor-funded amount
  is mirrored as the public global prize while user winnings remain encrypted.
  Plug in Aave / Morpho / Superlend only after the Sepolia bounty demo is
  stable. If an encrypted no-winner branch carries funds forward, that carry is
  intentionally not disclosed by the public mirror.
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
4. Document leakage, sponsor-funded mocked prize/yield, faucet, keeper flow, and
   deployed addresses.
5. Record the real-person demo and publish the X thread/article.
