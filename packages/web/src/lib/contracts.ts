// Contract addresses & ABIs. The active SorteCerta ABIs come from the shared
// protocol package.

import { erc20Abi } from "viem";

export {
  confidentialPrizePoolAbi,
  confidentialUsdcAbi,
  morphoYieldAdapterAbi,
} from "@sortecerta/protocol";

export const CONTRACTS = {
  usdc: (process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "") as `0x${string}`,
  confidentialUsdc: (process.env.NEXT_PUBLIC_CONFIDENTIAL_USDC_ADDRESS ?? "") as `0x${string}`,
  confidentialPrizePool: (process.env.NEXT_PUBLIC_CONFIDENTIAL_PRIZE_POOL_ADDRESS ?? "") as `0x${string}`,
} as const;

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 11155111);
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
export const PIMLICO_API_KEY = process.env.NEXT_PUBLIC_PIMLICO_API_KEY ?? "";
export const PIMLICO_URL = `https://api.pimlico.io/v2/sepolia/rpc?apikey=${PIMLICO_API_KEY}`;
export const WEB3AUTH_CLIENT_ID = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID ?? "";

export { erc20Abi };
