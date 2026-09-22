import type { IMarket } from "@morpho-org/blue-sdk";

import { asBigInt, tupleValues } from "./decoders.ts";

export type MarketState = Pick<
  IMarket,
  | "totalSupplyAssets"
  | "totalSupplyShares"
  | "totalBorrowAssets"
  | "totalBorrowShares"
  | "lastUpdate"
  | "fee"
>;

export type Position = {
  supplyShares: bigint;
  borrowShares: bigint;
  collateralAssets: bigint;
};

export type PositionHealth = {
  collateralValue: bigint;
  borrowLimit: bigint;
  borrowAssets: bigint;
  ltvWad?: bigint;
  liquidatable: boolean;
};

const MARKET_STATE_NAMES = [
  "totalSupplyAssets",
  "totalSupplyShares",
  "totalBorrowAssets",
  "totalBorrowShares",
  "lastUpdate",
  "fee",
] as const;

export function decodeMarketState(value: unknown): MarketState {
  const values = tupleValues(value, MARKET_STATE_NAMES).map((item, index) =>
    asBigInt(item, MARKET_STATE_NAMES[index]),
  );
  return {
    totalSupplyAssets: values[0],
    totalSupplyShares: values[1],
    totalBorrowAssets: values[2],
    totalBorrowShares: values[3],
    lastUpdate: values[4],
    fee: values[5],
  };
}

export function decodePosition(value: unknown): Position {
  const names = ["supplyShares", "borrowShares", "collateral"] as const;
  const values = tupleValues(value, names).map((item, index) =>
    asBigInt(item, names[index]),
  );
  return {
    supplyShares: values[0],
    borrowShares: values[1],
    collateralAssets: values[2],
  };
}
