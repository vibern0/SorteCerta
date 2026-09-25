import assert from "node:assert/strict";
import test from "node:test";

import {
  accruedBorrowAssets,
  accruedMarketState,
  decodeMarketState,
  decodePosition,
  positionHealth,
  safeBorrowCapacity,
  toBorrowAssetsUp,
  toSupplyAssetsDown,
  utilizationWad,
} from "../src/index.ts";

const state = {
  totalSupplyAssets: 10_000_000_000n,
  totalSupplyShares: 10_000_000_000_000_000n,
  totalBorrowAssets: 1_000_000_000n,
  totalBorrowShares: 1_000_000_000_000_000n,
  lastUpdate: 1n,
  fee: 100_000_000_000_000_000n,
};

test("Morpho math accrues supply, debt, and protocol fee shares", () => {
  const accrued = accruedMarketState(state, 1_000_000_000_000n, 1_001n);
  assert.deepEqual(accrued, {
    ...state,
    totalBorrowAssets: 1_001_000_500n,
    totalSupplyAssets: 10_001_000_500n,
    totalSupplyShares: 10_000_100_040_991_808n,
    lastUpdate: 1_001n,
  });
  assert.equal(state.totalBorrowAssets, 1_000_000_000n);
});

test("Morpho math validates explicit-rate accrual boundaries", () => {
  assert.throws(
    () => accruedMarketState(state, 1n, state.lastUpdate - 1n),
    /timestamp/i,
  );
  assert.throws(
    () =>
      accruedMarketState(
        { ...state, totalBorrowAssets: 1n },
        undefined,
        state.lastUpdate + 1n,
      ),
    /rate unavailable/i,
  );
  const zeroDebt = { ...state, totalBorrowAssets: 0n };
  assert.deepEqual(
    accruedMarketState(zeroDebt, undefined, state.lastUpdate + 1n),
    zeroDebt,
  );
});

test("Morpho math preserves Taylor accrual and share rounding", () => {
  assert.equal(
    accruedBorrowAssets(1_000_000_000n, 1_000_000_000_000n, 1_000n),
    1_001_000_500n,
  );
  assert.equal(
    accruedBorrowAssets(1_000_000_000n, 1_000_000_000_000n, 1_600n),
    1_001_601_280n,
  );
  assert.equal(
    toSupplyAssetsDown(
      56_891_532_399_737n,
      185_634_262n,
      185_606_640_011_820n,
    ),
    56_899_998n,
  );
  assert.equal(toBorrowAssetsUp(1n, 35_004_528n, 34_998_315_844_080n), 1n);
});

test("Morpho math preserves utilization and collateral health", () => {
  assert.equal(
    utilizationWad(35_004_528n, 185_634_262n),
    188_567_173_014_645_324n,
  );
  const health = positionHealth({
    collateralAssets: 1_000_000_000_000_000_000n,
    collateralPrice: 2_000n * 10n ** 24n,
    borrowAssets: 1_000_000_000n,
    lltv: 945_000_000_000_000_000n,
  });
  assert.equal(health.ltvWad, 500_000_000_000_000_000n);
  assert.equal(health.liquidatable, false);
  assert.equal(
    safeBorrowCapacity(health, 900_000_000_000_000_000n),
    800_000_000n,
  );
});

test("market state and positions decode positional and named tuples", () => {
  assert.deepEqual(decodeMarketState(Object.values(state)), state);
  assert.deepEqual(decodeMarketState(state), state);
  assert.deepEqual(decodePosition([1n, 2n, 3n]), {
    supplyShares: 1n,
    borrowShares: 2n,
    collateralAssets: 3n,
  });
  assert.deepEqual(
    decodePosition({ supplyShares: 1n, borrowShares: 2n, collateral: 3n }),
    { supplyShares: 1n, borrowShares: 2n, collateralAssets: 3n },
  );
});
