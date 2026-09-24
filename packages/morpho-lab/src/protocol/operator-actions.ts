import { buildCloseDrawRequest } from "@sortecerta/protocol";
import { getAddress } from "viem";

import type { LabConfig } from "../config";
import type { ProtocolSnapshot } from "../types";
import type { SimulatedWriteArgs } from "../wallet/MetaMaskProvider";

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
    ...buildCloseDrawRequest(pool),
    summary: `Close draw ${snapshot.pool.drawId.toString()}`,
  };
}
