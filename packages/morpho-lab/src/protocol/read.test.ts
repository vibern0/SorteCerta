import { getAddress, type Address, type Hex } from "viem";
import { describe, expect, it } from "vitest";

import { loadLabConfig } from "../config";
import { readProtocolSnapshot } from "./read";

const account = getAddress("0x1111111111111111111111111111111111111111");
const oracle = getAddress("0x2222222222222222222222222222222222222222");
const irm = getAddress("0x3333333333333333333333333333333333333333");
const handle =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Hex;

describe("readProtocolSnapshot", () => {
  it("reads deployment bindings, protocol metrics, market state, and an account position", async () => {
    const config = loadLabConfig({});
    const client = createClient(config, [
      config.usdc,
      config.weth,
      oracle,
      irm,
      945_000_000_000_000_000n,
    ]);

    const snapshot = await readProtocolSnapshot(client, config, account);

    expect(snapshot.blockNumber).toBe(123n);
    expect(snapshot.deployment.adapter).toBe(config.adapter);
    expect(snapshot.pool.drawId).toBe(7n);
    expect(snapshot.pool.withdrawalBatch.status).toBe(2);
    expect(snapshot.adapter.suppliedPrincipal).toBe(1_000_000n);
    expect(snapshot.adapter.marketParams.collateralToken).toBe(config.weth);
    expect(snapshot.market.state.totalSupplyAssets).toBe(185_634_262n);
    expect(snapshot.market.oraclePrice).toBe(2_000n * 10n ** 24n);
    expect(snapshot.market.borrowRatePerSecond).toBe(123n);
    expect(snapshot.account).toMatchObject({
      address: account,
      position: {
        supplyShares: 50n,
        borrowShares: 25n,
        collateralAssets: 1_000_000_000_000_000_000n,
      },
      tokens: { usdcBalance: 2_000_000n, usdcAllowance: 1_000_000n },
    });
    expect(snapshot.account?.encryptedPrincipalHandle).toBe(handle);
    expect(client.calls.map((call) => call.functionName)).toContain(
      "borrowRateView"
    );
    expect(client.calls.map((call) => call.functionName)).toContain(
      "allowance"
    );
    expect(client.calls.map((call) => call.functionName)).toContain("position");
    expect(client.calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          address: config.pool,
          functionName: "morphoYieldAdapter",
          blockNumber: 123n,
        }),
        expect.objectContaining({
          address: config.adapter,
          functionName: "suppliedPrincipal",
          blockNumber: 123n,
        }),
      ])
    );
    expect(client.calls.every((call) => call.blockNumber === 123n)).toBe(true);
  });

  it("fails visibly when the adapter market parameters differ from the configured deployment", async () => {
    const config = loadLabConfig({});
    const client = createClient(config, [
      config.usdc,
      config.weth,
      oracle,
      irm,
      900_000_000_000_000_000n,
    ]);

    await expect(readProtocolSnapshot(client, config)).rejects.toThrow(
      "Adapter market parameters"
    );
  });

  it("rejects a retired adapter before reading any of its state", async () => {
    const config = loadLabConfig({});
    const retiredAdapter = getAddress(
      "0x4444444444444444444444444444444444444444"
    );
    const client = createClient(
      config,
      [config.usdc, config.weth, oracle, irm, 945_000_000_000_000_000n],
      retiredAdapter
    );

    await expect(readProtocolSnapshot(client, config)).rejects.toThrow(
      "Configured adapter is not the pool's active Morpho adapter"
    );
    expect(
      client.calls.filter((call) => call.address === config.adapter)
    ).toHaveLength(0);
  });
});

function createClient(
  config: ReturnType<typeof loadLabConfig>,
  adapterMarketParams: readonly [Address, Address, Address, Address, bigint],
  activeAdapter = config.adapter
) {
  const calls: ReadRequest[] = [];

  return {
    calls,
    getBlockNumber: async () => 123n,
    readContract: async (request: ReadRequest) => {
      calls.push(request);
      const { functionName } = request;

      const values: Record<string, unknown> = {
        usdc: config.usdc,
        confidentialUsdc: config.wrapper,
        prizePool: config.pool,
        morpho: config.morpho,
        marketId: config.marketId,
        suppliedPrincipal: 1_000_000n,
        idlePrincipal: 1n,
        availablePrincipalAssets: 500_000n,
        accruedYieldAssets: 10_000n,
        suppliedAssets: 1_010_000n,
        marketParams: adapterMarketParams,
        idToMarketParams: [
          config.usdc,
          config.weth,
          oracle,
          irm,
          945_000_000_000_000_000n,
        ],
        market: [
          185_634_262n,
          185_606_640_011_820n,
          35_004_528n,
          34_998_315_844_080n,
          100n,
          0n,
        ],
        price: 2_000n * 10n ** 24n,
        borrowRateView: 123n,
        drawId: 7n,
        nextDrawAt: 2_000n,
        participantCount: 3n,
        publicPrizeReserve: 25_000n,
        morphoPendingDepositCount: 2n,
        lastMorphoUnwrapAt: 900n,
        morphoUnwrapInterval: 300n,
        encryptedTotalPrincipal: handle,
        encryptedPrizeReserve: handle,
        encryptedPendingMorphoPrincipal: handle,
        currentWithdrawalBatchId: 4n,
        withdrawalBatchStatus: 2,
        withdrawalBatchClosesAt: 1_500n,
        withdrawalBatchFunded: true,
        withdrawalBatchRestoredAmount: 125n,
        withdrawalBatchRequestCount: 2n,
        withdrawalBatchClaimantCount: 1n,
        position: [50n, 25n, 1_000_000_000_000_000_000n],
        balanceOf: 2_000_000n,
        allowance: 1_000_000n,
        confidentialBalanceOf: handle,
        encryptedPrincipalOf: handle,
        encryptedWinningsOf: handle,
        morphoYieldAdapter: activeAdapter,
      };

      return values[functionName];
    },
  };
}

type ReadRequest = {
  address: Address;
  abi: readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
  blockNumber?: bigint;
};
