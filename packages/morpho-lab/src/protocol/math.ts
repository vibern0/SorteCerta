import type { PositionHealth } from "../types";

export const WAD = 10n ** 18n;
export const VIRTUAL_SHARES = 1_000_000n;
export const VIRTUAL_ASSETS = 1n;

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
