import { MarketUtils, MathLib } from "@morpho-org/blue-sdk";

import type { MarketState, PositionHealth } from "./market-state.ts";

export const WAD = MathLib.WAD;

export function accruedMarketState(
  state: MarketState,
  rate: bigint | undefined,
  timestamp: bigint,
): MarketState {
  if (timestamp < state.lastUpdate) {
    throw new Error("Invalid accrual timestamp.");
  }
  if (timestamp === state.lastUpdate || state.totalBorrowAssets === 0n) {
    return state;
  }
  if (rate === undefined) {
    throw new Error("Borrow rate unavailable. Refresh before continuing.");
  }

  const { interest, feeShares } = MarketUtils.getAccruedInterest(
    rate,
    state,
    timestamp - state.lastUpdate,
  );
  return {
    ...state,
    totalBorrowAssets: state.totalBorrowAssets + interest,
    totalSupplyAssets: state.totalSupplyAssets + interest,
    totalSupplyShares: state.totalSupplyShares + feeShares,
    lastUpdate: timestamp,
  };
}

export function accruedBorrowAssets(
  totalAssets: bigint,
  ratePerSecond: bigint,
  elapsed: bigint,
): bigint {
  if (totalAssets < 0n || ratePerSecond < 0n || elapsed < 0n) {
    throw new Error("Invalid accrual inputs.");
  }
  const growth = MathLib.wTaylorCompounded(ratePerSecond, elapsed);
  return totalAssets + MathLib.wMulDown(totalAssets, growth);
}

export function toSupplyAssetsDown(
  shares: bigint,
  totalSupplyAssets: bigint,
  totalSupplyShares: bigint,
): bigint {
  return MarketUtils.toSupplyAssets(
    shares,
    { totalSupplyAssets, totalSupplyShares },
    "Down",
  );
}

export function toBorrowAssetsUp(
  shares: bigint,
  totalBorrowAssets: bigint,
  totalBorrowShares: bigint,
): bigint {
  return MarketUtils.toBorrowAssets(
    shares,
    { totalBorrowAssets, totalBorrowShares },
    "Up",
  );
}

export function utilizationWad(
  totalBorrowAssets: bigint,
  totalSupplyAssets: bigint,
): bigint {
  return MarketUtils.getUtilization({ totalBorrowAssets, totalSupplyAssets });
}

export function positionHealth(input: {
  collateralAssets: bigint;
  collateralPrice: bigint;
  borrowAssets: bigint;
  lltv: bigint;
}): PositionHealth {
  const collateralValue = MarketUtils.getCollateralValue(
    input.collateralAssets,
    { price: input.collateralPrice },
  );
  const borrowLimit = MarketUtils.getMaxBorrowAssets(
    input.collateralAssets,
    { price: input.collateralPrice },
    { lltv: input.lltv },
  );
  if (collateralValue === undefined || borrowLimit === undefined) {
    throw new Error("Collateral price unavailable.");
  }

  return {
    collateralValue,
    borrowLimit,
    borrowAssets: input.borrowAssets,
    ltvWad:
      collateralValue === 0n
        ? undefined
        : MathLib.wDivDown(input.borrowAssets, collateralValue),
    liquidatable: input.borrowAssets > borrowLimit,
  };
}

export function safeBorrowCapacity(
  health: PositionHealth,
  targetLltv: bigint,
): bigint {
  const targetBorrowAssets = MathLib.wMulDown(
    health.collateralValue,
    targetLltv,
  );
  return targetBorrowAssets > health.borrowAssets
    ? targetBorrowAssets - health.borrowAssets
    : 0n;
}
