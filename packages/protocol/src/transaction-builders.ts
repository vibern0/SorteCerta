import { getAddress, type Address, type Hex } from "viem";

import { confidentialPrizePoolAbi, confidentialUsdcAbi } from "./abis/index.ts";

export function buildCloseDrawRequest(pool: Address) {
  return {
    address: getAddress(pool),
    abi: confidentialPrizePoolAbi,
    functionName: "closeDraw",
    args: [],
  } as const;
}

export function buildFinalizeUnwrapRequest(
  wrapper: Address,
  requestId: Hex,
  amount: bigint,
  proof: Hex,
) {
  return {
    address: getAddress(wrapper),
    abi: confidentialUsdcAbi,
    functionName: "finalizeUnwrap",
    args: [requestId, amount, proof],
  } as const;
}
