# SorteCerta Agent Notes

Read [docs/BOUNTY_SCOPE.md](docs/BOUNTY_SCOPE.md) and
[docs/ROADMAP.md](docs/ROADMAP.md) before making architecture, contract,
deployment, or network decisions.

## Non-negotiable project scope

- This project targets the Zama Developer Program Mainnet Season 4 bounty:
  **Build the Confidential PoolTogether App**.
- "PoolTogether" describes the no-loss prize-savings mechanic. The bounty does
  not require integrating or deploying the official PoolTogether protocol.
- Build and deploy the complete demo on Ethereum Sepolia, where the Zama
  Protocol testnet is available.
- Use Zama FHE for encrypted deposits/balances, deposit-weighted onchain winner
  selection with FHE randomness, confidential winnings, and EIP-712 user
  decryption.
- Always pass checksum `0x...` addresses into Zama SDK/relayer calls. Normalize
  with `viem.getAddress()` or equivalent. Do not lowercase addresses for
  `createEncryptedInput`, `createEIP712`, `userDecrypt`, handle/contract pairs,
  or frontend env-derived contract addresses.
- A test ERC-20 and documented mock yield source/admin-funded prize reserve are
  explicitly acceptable.
- Do not switch to Base, Optimism, or another PoolTogether deployment network
  merely to use official PoolTogether contracts.
- Mainnet deployment is not a bounty submission requirement. "Mainnet Season
  4" is the program season name; the challenge requires a working Sepolia demo.

## Current implementation status

The existing `MockUSDC`, ERC-4626 `Vault`, and plaintext `PrizePool` are an
early prototype. They do not yet satisfy the bounty's confidentiality or FHE
randomness requirements. Treat them as replaceable scaffolding, not the target
architecture.

## Zama SDK implementation notes

- The Phase 1 browser spike failed with `User address is not a valid address`
  until wallet and contract addresses were normalized to checksum form. Keep
  this invariant throughout the app.
- The EIP-712 object returned by Zama can contain `bigint` values. Serialize
  typed data with a replacer that converts `bigint` to string before calling
  `eth_signTypedData_v4`; plain `JSON.stringify(eip712)` can throw
  `Do not know how to serialize a BigInt`.
