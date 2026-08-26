# SorteCerta — Web (PWA)

Mobile-first PWA. Next.js 14 (App Router) + Tailwind + wagmi v2 + Web3Auth +
permissionless (Safe smart account) + Pimlico.

## Stack

- **Next.js 14** — App Router, RSC where it makes sense, `"use client"` for
  anything wallet-related.
- **Tailwind 3** — custom design tokens in `tailwind.config.ts` (dark theme,
  mobile-first `.app-shell`).
- **wagmi v2** + **viem v2** — chain reads, contract calls, event watching.
- **Web3Auth modal** — Google + Apple sign-in used to derive the smart account.
- **permissionless** + **Safe** — Safe smart account with EntryPoint v0.7.
  Pimlico is the bundler + paymaster.

## Pages

| Path | Purpose |
| --- | --- |
| `/` | Landing — hero, next-draw countdown, connect CTA, "how it works". |
| `/savings` | Deposit / withdraw USDC, see balance + tickets. |
| `/draw` | Current draw — countdown, prize pool, sponsor / close. |
| `/history` | Last 20 draws, winners. |
| `/profile` | Smart account, balances, network info, sign out. |

## Setup

```bash
cp .env.example .env.local
# fill in:
#   NEXT_PUBLIC_USDC_ADDRESS, NEXT_PUBLIC_VAULT_ADDRESS, NEXT_PUBLIC_PRIZE_POOL_ADDRESS
#   NEXT_PUBLIC_WEB3AUTH_CLIENT_ID
#   NEXT_PUBLIC_PIMLICO_API_KEY
npm run dev
```

## Where things live

```
src/
  app/
    layout.tsx           # font, metadata, providers
    providers.tsx        # wagmi + react-query + wallet
    page.tsx             # landing
    savings/page.tsx     # deposit/withdraw form
    draw/page.tsx        # active draw
    history/page.tsx     # past draws
    profile/page.tsx     # account info
  components/
    Header.tsx           # top nav + connect button
    ConnectButton.tsx    # social-login CTA
    Countdown.tsx        # draw countdown timer
  lib/
    contracts.ts         # addresses, ABIs, RPC, Pimlico URL
    wagmi.ts             # wagmi config (Sepolia)
    web3auth.ts          # AA flow — Web3Auth + Safe + Pimlico
    wallet-context.tsx   # React context exposing session
    usePoolData.ts       # wagmi hooks for prize-pool reads
    format.ts            # USDC + countdown formatters
    cn.ts                # tailwind-merge className helper
```

## Notes

- All contract calls go through `smartAccountClient.sendTransaction` (Pimlico
  bundler + paymaster), so the user signs UserOps through the Safe account.
- USDC `approve` is a one-time setup per session, sent as its own UserOp.
