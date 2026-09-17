import type { MarketState, PositionHealth } from "../types";

export const WAD = 10n ** 18n;
export const VIRTUAL_SHARES = 1_000_000n;
export const VIRTUAL_ASSETS = 1n;

export function accruedMarketState(
  state: MarketState,
  rate: bigint | undefined,
  timestamp: bigint
): MarketState {
  if (timestamp < state.lastUpdate)
    throw new Error("Invalid accrual timestamp.");
  if (timestamp === state.lastUpdate || state.totalBorrowAssets === 0n)
    return state;
  if (rate === undefined)
    throw new Error("Borrow rate unavailable. Refresh before continuing.");
  const totalBorrowAssets = accruedBorrowAssets(
    state.totalBorrowAssets,
    rate,
    timestamp - state.lastUpdate
  );
  const interest = totalBorrowAssets - state.totalBorrowAssets;
  const totalSupplyAssets = state.totalSupplyAssets + interest;
  const feeAssets = (interest * state.fee) / WAD;
  // Morpho mints fee shares against supply after interest, excluding the fee itself.
  const feeShares =
    (feeAssets * (state.totalSupplyShares + VIRTUAL_SHARES)) /
    (totalSupplyAssets - feeAssets + VIRTUAL_ASSETS);
  return {
    ...state,
    totalBorrowAssets,
    totalSupplyAssets,
    totalSupplyShares: state.totalSupplyShares + feeShares,
    lastUpdate: timestamp,
  };
}

// Morpho MathLib.wTaylorCompounded, including each integer rounding step.
export function accruedBorrowAssets(
  totalAssets: bigint,
  ratePerSecond: bigint,
  elapsed: bigint
): bigint {
  if (totalAssets < 0n || ratePerSecond < 0n || elapsed < 0n)
    throw new Error("Invalid accrual inputs.");
  const first = ratePerSecond * elapsed;
  const second = (first * first) / (2n * WAD);
  const third = (second * first) / (3n * WAD);
  return totalAssets + (totalAssets * (first + second + third)) / WAD;
}

export function toSupplyAssetsDown(
  shares: bigint,
  totalAssets: bigint,
  totalShares: bigint
): bigint {
  return (
    (shares * (totalAssets + VIRTUAL_ASSETS)) / (totalShares + VIRTUAL_SHARES)
  );
}

export function toBorrowAssetsUp(
  shares: bigint,
  totalAssets: bigint,
  totalShares: bigint
): bigint {
  return divUp(
    shares * (totalAssets + VIRTUAL_ASSETS),
    totalShares + VIRTUAL_SHARES
  );
}

export function utilizationWad(
  totalBorrowAssets: bigint,
  totalSupplyAssets: bigint
): bigint {
  return totalSupplyAssets === 0n
    ? 0n
    : (totalBorrowAssets * WAD) / totalSupplyAssets;
}

export function positionHealth(input: {
  collateralAssets: bigint;
  collateralPrice: bigint;
  borrowAssets: bigint;
  lltv: bigint;
}): PositionHealth {
  const collateralValue =
    (input.collateralAssets * input.collateralPrice) / 10n ** 36n;
  const borrowLimit = (collateralValue * input.lltv) / WAD;
  const ltvWad =
    collateralValue === 0n
      ? undefined
      : (input.borrowAssets * WAD) / collateralValue;

  return {
    collateralValue,
    borrowLimit,
    borrowAssets: input.borrowAssets,
    ltvWad,
    liquidatable: input.borrowAssets > borrowLimit,
  };
}

export function safeBorrowCapacity(
  health: PositionHealth,
  targetLltv: bigint
): bigint {
  const targetBorrowAssets = (health.collateralValue * targetLltv) / WAD;
  return targetBorrowAssets > health.borrowAssets
    ? targetBorrowAssets - health.borrowAssets
    : 0n;
}

function divUp(numerator: bigint, denominator: bigint): bigint {
  return numerator === 0n ? 0n : (numerator - 1n) / denominator + 1n;
}
