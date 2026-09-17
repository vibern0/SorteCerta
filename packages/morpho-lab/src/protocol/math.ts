import type { PositionHealth } from "../types";

export const WAD = 10n ** 18n;
export const VIRTUAL_SHARES = 1_000_000n;
export const VIRTUAL_ASSETS = 1n;

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
