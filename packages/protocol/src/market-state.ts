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
  const [supplyAssets, supplyShares, borrowAssets, borrowShares, lastUpdate, fee] =
    tupleValues(value, MARKET_STATE_NAMES);
  return {
    totalSupplyAssets: asBigInt(supplyAssets, "totalSupplyAssets"),
    totalSupplyShares: asBigInt(supplyShares, "totalSupplyShares"),
    totalBorrowAssets: asBigInt(borrowAssets, "totalBorrowAssets"),
    totalBorrowShares: asBigInt(borrowShares, "totalBorrowShares"),
    lastUpdate: asBigInt(lastUpdate, "lastUpdate"),
    fee: asBigInt(fee, "fee"),
  };
}

export function decodePosition(value: unknown): Position {
  const names = ["supplyShares", "borrowShares", "collateral"] as const;
  const [supplyShares, borrowShares, collateral] = tupleValues(value, names);
  return {
    supplyShares: asBigInt(supplyShares, "supplyShares"),
    borrowShares: asBigInt(borrowShares, "borrowShares"),
    collateralAssets: asBigInt(collateral, "collateral"),
  };
}
