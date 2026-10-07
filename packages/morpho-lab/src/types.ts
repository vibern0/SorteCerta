import type { ProtocolSnapshotData } from "@kettigo/protocol";

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
} from "@kettigo/protocol";

export type ProtocolSnapshot = ProtocolSnapshotData & { refreshedAt: number };
