# Bounty Scope and Architecture Decision

## Decision

SorteCerta will implement the PoolTogether **mechanic** as its own confidential
prize-savings protocol on Ethereum Sepolia. It will not integrate with or deploy
the official PoolTogether protocol.

This interpretation follows the challenge language: build a dApp that
"recreates the core PoolTogether mechanic" and supports the complete
deposit, draw, claim, and withdraw cycle onchain. Official PoolTogether
contracts, SDKs, and deployed networks are not listed as requirements or
developer resources.

## Why Ethereum Sepolia

The challenge requires a public Sepolia deployment and links to Zama's Sepolia
testnet addresses. Keeping contracts and frontend on one chain allows encrypted
state, FHE winner selection, user decryption, and token movement to compose in a
single transaction flow. PoolTogether's separate testnet deployments are not
relevant because official PoolTogether integration is out of scope.

## Required target behavior

The final bounty implementation must provide:

1. Deposit a test ERC-20 through an approval and confidential wrap/deposit flow.
2. Store individual deposits, balances, and pool shares as encrypted values
   using ERC-7984 or encrypted-integer accounting.
3. Select a winner onchain using Zama FHE randomness and deposit-weighted logic
   over encrypted balances. No offchain RNG or plaintext balance calculation.
4. Credit prizes confidentially so only the winning user can decrypt their
   winnings.
5. Use the Zama EIP-712 user-decryption flow for the connected user's balance
   and winnings.
6. Let every user withdraw their full principal at any time.
7. Automate draws or document a keeper/admin trigger.
8. Provide a faucet or clear instructions for obtaining the test token.
9. Document information leakage and the mock yield source.

## Accepted simplifications

- A test ERC-20 is acceptable, but the Sepolia demo should prefer Circle's
  official Sepolia USDC when practical:
  `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`.
- The bounty's `5,000 cUSDT` amount is the organizer's reward pool, not a
  requirement that SorteCerta accept cUSDT or USDT deposits.
- An admin-funded prize reserve or other mock yield source is acceptable on
  Sepolia when its behavior and real-yield replacement point are documented.
- A documented keeper/admin draw trigger is acceptable.

## Explicit non-goals for the bounty

- Integrating official PoolTogether deployments.
- Cross-chain messaging between Sepolia and a PoolTogether testnet.
- Deploying PoolTogether's complete protocol stack.
- Deploying SorteCerta to mainnet before submission.
- Integrating a real yield protocol before the Sepolia demo works end to end.

## Current gap

The repository's initial `MockUSDC`, ERC-4626 `Vault`, and `PrizePool` use
plaintext balances and `blockhash` randomness. They demonstrate only the basic
no-loss lifecycle. They are not bounty-compliant and must be replaced or
substantially redesigned around Zama confidential token/accounting primitives,
FHE randomness, confidential prize crediting, and EIP-712 user decryption.

## Delivery order

1. Implement and test the complete confidential lifecycle locally with Zama's
   Hardhat tooling.
2. Deploy contracts to Ethereum Sepolia and run multi-wallet end-to-end tests.
3. Deploy the frontend and verify deposit, decrypt, draw, claim, and withdraw
   against the public Sepolia contracts.
4. Document leakage, mock yield, deployment addresses, keeper flow, and judge
   setup in the README.
5. Record the real-person demo and publish the X thread/article.
6. Consider audit, real yield, and mainnet only after the bounty version is
   stable.

"Mainnet Season 4" names the developer-program season. It does not override the
challenge's explicit requirement for a live Ethereum Sepolia deployment.
