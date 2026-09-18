import { getAddress, type Address } from "viem";

import type { LabConfig } from "../config";
import type { ProtocolSnapshot } from "../types";
import type { SimulatedWriteArgs } from "../wallet/MetaMaskProvider";

const closeDrawAbi = [
  {
    type: "function",
    name: "closeDraw",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

export function buildCloseDraw(
  config: Pick<LabConfig, "pool">,
  snapshot: {
    deployment: Pick<ProtocolSnapshot["deployment"], "pool">;
    pool: Pick<ProtocolSnapshot["pool"], "drawId">;
  }
): SimulatedWriteArgs {
  const pool = getAddress(config.pool);
  if (getAddress(snapshot.deployment.pool) !== pool) {
    throw new Error("Pool deployment binding changed. Refresh before continuing.");
  }

  return {
    address: pool as Address,
    abi: closeDrawAbi,
    functionName: "closeDraw",
    args: [],
    summary: `Close draw ${snapshot.pool.drawId.toString()}`,
  };
}
