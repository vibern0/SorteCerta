import assert from "node:assert/strict";
import test from "node:test";

import { projectMorphoYield, readProjectedMorphoYield } from "../src/index.ts";

const addresses = {
  pool: "0x1111111111111111111111111111111111111111",
  adapter: "0x2222222222222222222222222222222222222222",
  morpho: "0x3333333333333333333333333333333333333333",
  loanToken: "0x4444444444444444444444444444444444444444",
  collateralToken: "0x5555555555555555555555555555555555555555",
  oracle: "0x6666666666666666666666666666666666666666",
  irm: "0x7777777777777777777777777777777777777777",
};

const marketId = `0x${"ab".repeat(32)}`;
const marketParams = {
  loanToken: addresses.loanToken,
  collateralToken: addresses.collateralToken,
  oracle: addresses.oracle,
  irm: addresses.irm,
  lltv: 945_000_000_000_000_000n,
};
const market = {
  totalSupplyAssets: 1_000_000_000n,
  totalSupplyShares: 1_000_000_000_000_000n,
  totalBorrowAssets: 500_000_000n,
  totalBorrowShares: 500_000_000_000_000n,
  lastUpdate: 100n,
  fee: 100_000_000_000_000_000n,
};

test("projects Morpho yield with SDK accrual and virtual liquidity", () => {
  assert.equal(projectMorphoYield({
    market,
    borrowRatePerSecond: 100_000_000_000_000n,
    blockTimestamp: 1_100n,
    supplyShares: 100_000_000_000_000n,
    suppliedPrincipal: 100_000_000n,
    idlePrincipal: 3n,
  }), 4_732_502n);
});

test("floors projected yield at zero below principal", () => {
  assert.equal(projectMorphoYield({
    market,
    borrowRatePerSecond: 1_000_000_000_000n,
    blockTimestamp: 1_100n,
    supplyShares: 100_000_000_000_000n,
    suppliedPrincipal: 100_045_026n,
    idlePrincipal: 3n,
  }), 0n);
});

test("reads the active adapter projection entirely at one pinned block", async () => {
  const requests = [];
  const client = projectionClient({ requests });
  const result = await readProjectedMorphoYield(client, addresses.pool, 77n);

  assert.deepEqual(result, { blockNumber: 77n, accruedYieldAssets: 4_732_502n, source: "projected" });
  assert.equal(requests.length, 9);
  assert.ok(requests.every((request) => request.blockNumber === 77n));
  assert.deepEqual(client.blockRequests, [{ blockNumber: 77n }]);
  assert.equal(requests.find((request) => request.functionName === "market").address, addresses.morpho);
  assert.equal(requests.find((request) => request.functionName === "borrowRateView").address, addresses.irm);
});

test("uses a same-block stored fallback when projection inputs are unavailable", async () => {
  const requests = [];
  const client = projectionClient({ requests, failAt: "borrowRateView" });
  const result = await readProjectedMorphoYield(client, addresses.pool, 77n);

  assert.deepEqual(result, { blockNumber: 77n, accruedYieldAssets: 12n, source: "stored" });
  assert.ok(requests.every((request) => request.blockNumber === 77n));
  assert.deepEqual(client.blockRequests, [{ blockNumber: 77n }]);
});

test("does not read stored yield after a successful projection", async () => {
  const client = projectionClient({ failAt: "morphoAccruedYieldAssets" });
  const result = await readProjectedMorphoYield(client, addresses.pool, 77n);
  assert.deepEqual(result, { blockNumber: 77n, accruedYieldAssets: 4_732_502n, source: "projected" });
});

function projectionClient({ requests = [], failAt } = {}) {
  return {
    blockRequests: [],
    async getBlock({ blockNumber }) {
      this.blockRequests.push({ blockNumber });
      return { timestamp: 1_100n };
    },
    async readContract(request) {
      requests.push(request);
      if (request.functionName === failAt) throw new Error("Unavailable");
      const values = {
        morphoAccruedYieldAssets: 12n,
        morphoYieldAdapter: addresses.adapter,
        morpho: addresses.morpho,
        marketId,
        suppliedPrincipal: 100_000_000n,
        idlePrincipal: 3n,
        marketParams,
        market,
        position: { supplyShares: 100_000_000_000_000n, borrowShares: 0n, collateral: 0n },
        borrowRateView: 100_000_000_000_000n,
      };
      if (!(request.functionName in values)) throw new Error(`Unexpected read: ${request.functionName}`);
      return values[request.functionName];
    },
  };
}
