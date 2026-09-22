import type { ProtocolSnapshotData } from "@sortecerta/protocol";

export type {
  AccountSnapshot,
  AdapterSnapshot,
  DeploymentSnapshot,
  NormalizedMarketParams as MarketParams,
  MarketState,
  MorphoMarketSnapshot,
  PoolSnapshot,
  Position,
  PositionHealth,
  TokenSnapshot,
  WithdrawalBatchSnapshot,
} from "@sortecerta/protocol";

export type ProtocolSnapshot = ProtocolSnapshotData & { refreshedAt: number };
