import { describe, expect, it } from "vitest";

import {
  accruedBorrowAssets,
  accruedMarketState,
  positionHealth,
  safeBorrowCapacity,
  toBorrowAssetsUp,
  toSupplyAssetsDown,
  utilizationWad,
} from "./math";

describe("Morpho math", () => {
  it("accrues supply and debt together and dilutes supply shares for protocol fees", () => {
    const stored = {
      totalSupplyAssets: 10_000_000_000n,
      totalSupplyShares: 10_000_000_000_000_000n,
      totalBorrowAssets: 1_000_000_000n,
      totalBorrowShares: 1_000_000_000_000_000n,
      lastUpdate: 1n,
      fee: 100_000_000_000_000_000n,
    };
    const accrued = accruedMarketState(stored, 1_000_000_000_000n, 1_001n);
    expect(accrued).toEqual({
      ...stored,
      totalBorrowAssets: 1_001_000_500n,
      totalSupplyAssets: 10_001_000_500n,
      totalSupplyShares: 10_000_100_040_991_808n,
      lastUpdate: 1_001n,
    });
    expect(accrued.totalSupplyAssets - accrued.totalBorrowAssets).toBe(
      9_000_000_000n
    );
    expect(stored.totalBorrowAssets).toBe(1_000_000_000n);
  });
  it("includes unrecorded interest using Morpho's three-term accrual and rounding", () => {
    expect(
      accruedBorrowAssets(1_000_000_000n, 1_000_000_000_000n, 1_000n)
    ).toBe(1_001_000_500n);
    expect(
      accruedBorrowAssets(1_000_000_000n, 1_000_000_000_000n, 1_600n)
    ).toBe(1_001_601_280n);
    expect(accruedBorrowAssets(1_000_000_000n, 0n, 1_000n)).toBe(
      1_000_000_000n
    );
    expect(accruedBorrowAssets(1_000_000_000n, 1_000_000_000_000n, 0n)).toBe(
      1_000_000_000n
    );
  });
  it("converts supply shares to assets with virtual shares and downward rounding", () => {
    expect(
      toSupplyAssetsDown(
        56_891_532_399_737n,
        185_634_262n,
        185_606_640_011_820n
      )
    ).toBe(56_899_998n);
  });

  it("converts borrow shares to assets with upward rounding", () => {
    expect(toBorrowAssetsUp(1n, 35_004_528n, 34_998_315_844_080n)).toBe(1n);
  });

  it("calculates utilization as a wad", () => {
    expect(utilizationWad(35_004_528n, 185_634_262n)).toBe(
      188_567_173_014_645_324n
    );
  });

  it("calculates collateral health from the oracle price scale", () => {
    const health = positionHealth({
      collateralAssets: 1_000_000_000_000_000_000n,
      collateralPrice: 2_000n * 10n ** 24n,
      borrowAssets: 1_000_000_000n,
      lltv: 945_000_000_000_000_000n,
    });

    expect(health.ltvWad).toBe(500_000_000_000_000_000n);
    expect(health.liquidatable).toBe(false);
    expect(safeBorrowCapacity(health, 900_000_000_000_000_000n)).toBe(
      800_000_000n
    );
  });
});
