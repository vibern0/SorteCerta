import {
  readProtocolSnapshotAtBlock,
  type ProtocolReadClient as SharedReadClient,
} from "@sortecerta/protocol";
import type { Address } from "viem";

import type { LabConfig } from "../config";
import type { ProtocolSnapshot } from "../types";

export type ProtocolReadClient = SharedReadClient & {
  getBlockNumber(): Promise<bigint>;
};

export async function readProtocolSnapshot(
  client: ProtocolReadClient,
  config: LabConfig,
  account?: Address,
): Promise<ProtocolSnapshot> {
  const blockNumber = await client.getBlockNumber();
  const snapshot = await readProtocolSnapshotAtBlock(client, config, blockNumber, account);
  return { ...snapshot, refreshedAt: Date.now() };
}
