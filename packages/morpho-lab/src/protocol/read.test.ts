import {
  decodeFunctionResult,
  encodeFunctionResult,
  getAddress,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountPanel } from "../components/AccountPanel";
import { AdapterPanel } from "../components/AdapterPanel";
import { MarketPanel } from "../components/MarketPanel";
import { AmountAction } from "../components/AmountAction";
import { Workbench } from "../components/Workbench";
import { createActionContext } from "./actions";
import { MetaMaskProvider } from "../wallet/MetaMaskProvider";

import { loadLabConfig } from "../config";
import { readProtocolSnapshot } from "./read";

const account = getAddress("0x1111111111111111111111111111111111111111");
const oracle = getAddress("0x2222222222222222222222222222222222222222");
const irm = getAddress("0x3333333333333333333333333333333333333333");
const handle =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Hex;

describe("readProtocolSnapshot", () => {
  it("maps complete telemetry with spender-specific allowances to dashboard metrics", async () => {
    const config = loadLabConfig({});
    const client = createClient(config, [
      config.usdc,
      config.weth,
      oracle,
      irm,
      945_000_000_000_000_000n,
    ]);
    const snapshot = await readProtocolSnapshot(client, config, account);
    expect(snapshot.adapter).toMatchObject({
      usdcBalance: 500_001n,
      supplyShares: 1_000_000_000_000n,
      backingDifference: 149n,
    });
    expect(snapshot.market).toMatchObject({
      liquidity: 150_629_734n,
      supplierRatePerSecond: 23n,
    });
    expect(snapshot.account).toMatchObject({
      suppliedAssets: 0n,
      remainingBorrowCapacity: 1_889_999_999n,
    });
    for (const [element, labels] of [
      [
        createElement(AdapterPanel, { adapter: snapshot.adapter }),
        ["USDC balance", "Supply shares", "Backing minus tracked principal"],
      ],
      [
        createElement(MarketPanel, { market: snapshot.market }),
        ["Available liquidity", "Estimated supplier APR"],
      ],
      [
        createElement(AccountPanel, { account: snapshot.account }),
        [
          "ETH balance",
          "WETH balance",
          "Supplied assets",
          "Remaining LLTV capacity",
          "USDC allowance to wrapper",
          "USDC allowance to Morpho",
          "WETH allowance to Morpho",
        ],
      ],
    ] as const) {
      const markup = renderToStaticMarkup(element);
      for (const label of labels) expect(markup).toContain(label);
    }
  });

  it("includes idle-market interest in displayed debt, health, and remaining capacity", async () => {
    const config = loadLabConfig({});
    const base = createClient(config, [
      config.usdc,
      config.weth,
      oracle,
      irm,
      945_000_000_000_000_000n,
    ]);
    const client = {
      ...base,
      readContract: async (request: ReadRequest) => {
        const value = await base.readContract(request);
        if (request.functionName === "market")
          return [
            10_000_000_000n,
            10_000_000_000_000_000n,
            1_000_000_000n,
            1_000_000_000_000_000n,
            0n,
            0n,
          ];
        if (request.functionName === "borrowRateView")
          return 1_000_000_000_000n;
        if (
          request.functionName === "position" &&
          request.args?.[1] === account
        )
          return [0n, 500_000_000_000_000n, 10n ** 18n];
        return value;
      },
    };
    const snapshot = await readProtocolSnapshot(client, config, account);
    expect(snapshot.account?.health?.borrowAssets).toBe(500_500_250n);
    expect(snapshot.account?.remainingBorrowCapacity).toBe(1_389_499_750n);
    expect(snapshot.market.state.totalBorrowAssets).toBe(1_000_000_000n);
    const unavailable = await readProtocolSnapshot(
      {
        ...client,
        readContract: async (request) => {
          if (request.functionName === "borrowRateView")
            throw new Error("IRM unavailable");
          return client.readContract(request);
        },
      },
      config,
      account
    );
    expect(unavailable.account?.health).toBeUndefined();
    expect(unavailable.market.supplierRatePerSecond).toBeUndefined();
    const markup = renderToStaticMarkup(
      createElement(AmountAction, {
        context: createActionContext(config, unavailable),
        action: "withdrawUsdc",
        all: true,
        disabled: false,
        onRun: async () => {},
      })
    );
    expect(markup).toContain("Borrow rate unavailable");

    const synchronouslyUnavailable = await readProtocolSnapshot(
      {
        ...client,
        readContract(request) {
          if (request.functionName === "borrowRateView")
            throw new Error("IRM unavailable synchronously");
          return client.readContract(request);
        },
      },
      config,
      account,
    );
    expect(synchronouslyUnavailable.market.borrowRatePerSecond).toBeUndefined();
  });

  it("shows only the empty state when no wallet account was read", async () => {
    const config = loadLabConfig({});
    const snapshot = await readProtocolSnapshot(
      createClient(config, [
        config.usdc,
        config.weth,
        oracle,
        irm,
        945_000_000_000_000_000n,
      ]),
      config,
    );
    const markup = renderToStaticMarkup(
      createElement(
        MetaMaskProvider,
        { config },
        createElement(Workbench, {
          config,
          snapshot,
          refresh: async () => snapshot,
          stale: false,
        }),
      ),
    );

    expect(markup).toContain("Connect MetaMask and refresh your account balances.");
    expect(markup).not.toContain("Connect MetaMask before continuing.");
  });

  it("projects adapter supplied assets and yield from the pinned market timestamp", async () => {
    const config = loadLabConfig({});
    const base = createClient(config, [
      config.usdc,
      config.weth,
      oracle,
      irm,
      945_000_000_000_000_000n,
    ]);
    const client = {
      ...base,
      readContract: async (request: ReadRequest) => {
        const value = await base.readContract(request);
        if (request.functionName === "market")
          return [
            10_000_000_000n,
            10_000_000_000_000_000n,
            1_000_000_000n,
            1_000_000_000_000_000n,
            0n,
            0n,
          ];
        if (request.functionName === "borrowRateView")
          return 1_000_000_000_000n;
        if (
          request.functionName === "position" &&
          request.args?.[1] === config.adapter
        )
          return [1_000_000_000_000_000n, 0n, 0n];
        if (request.functionName === "suppliedPrincipal")
          return 1_000_000_000n;
        if (request.functionName === "idlePrincipal") return 1n;
        if (request.functionName === "suppliedAssets")
          return 1_000_000_000n;
        if (request.functionName === "accruedYieldAssets") return 0n;
        return value;
      },
    };

    const snapshot = await readProtocolSnapshot(client, config, account);

    expect(snapshot.adapter.suppliedAssets).toBe(1_000_100_050n);
    expect(snapshot.adapter.accruedYieldAssets).toBe(100_050n);
    expect(snapshot.adapter.backingDifference).toBe(100_050n);
  });

  it("floors projected yield at zero when supplied assets are below principal", async () => {
    const config = loadLabConfig({});
    const base = createClient(config, [
      config.usdc,
      config.weth,
      oracle,
      irm,
      945_000_000_000_000_000n,
    ]);
    const snapshot = await readProtocolSnapshot(
      {
        ...base,
        readContract: async (request: ReadRequest) => {
          const value = await base.readContract(request);
          if (request.functionName === "market")
            return [
              10_000_000_000n,
              10_000_000_000_000_000n,
              1_000_000_000n,
              1_000_000_000_000_000n,
              0n,
              0n,
            ];
          if (request.functionName === "borrowRateView")
            return 1_000_000_000_000n;
          if (
            request.functionName === "position" &&
            request.args?.[1] === config.adapter
          )
            return [1_000_000_000_000_000n, 0n, 0n];
          if (request.functionName === "suppliedPrincipal")
            return 1_000_200_000n;
          if (request.functionName === "idlePrincipal") return 1n;
          return value;
        },
      },
      config,
      account
    );

    expect(snapshot.adapter.suppliedAssets).toBe(1_000_100_050n);
    expect(snapshot.adapter.accruedYieldAssets).toBe(0n);
    expect(snapshot.adapter.backingDifference).toBe(-99_950n);
  });

  it("keeps raw adapter values when projected market state is unavailable", async () => {
    const config = loadLabConfig({});
    const base = createClient(config, [
      config.usdc,
      config.weth,
      oracle,
      irm,
      945_000_000_000_000_000n,
    ]);
    const snapshot = await readProtocolSnapshot(
      {
        ...base,
        readContract: async (request: ReadRequest) => {
          if (request.functionName === "borrowRateView")
            throw new Error("IRM unavailable");
          return base.readContract(request);
        },
      },
      config,
      account
    );

    expect(snapshot.adapter.suppliedAssets).toBe(1_010_000n);
    expect(snapshot.adapter.accruedYieldAssets).toBe(10_000n);
    expect(snapshot.adapter.backingDifference).toBe(10_000n);
  });

  it("accepts named tuple objects returned by viem ABI decoding", async () => {
    const config = loadLabConfig({});
    const client = createClient(config, [
      config.usdc,
      config.weth,
      oracle,
      irm,
      945_000_000_000_000_000n,
    ]);
    const snapshot = await readProtocolSnapshot(
      {
        ...client,
        async readContract(request) {
          const result = await client.readContract(request);
          const abi = request.abi as Abi;
          return decodeFunctionResult({
            abi,
            functionName: request.functionName,
            data: encodeFunctionResult({
              abi,
              functionName: request.functionName,
              result,
            }),
          });
        },
      },
      config,
      account
    );
    expect(snapshot.adapter.marketParams.lltv).toBe(945_000_000_000_000_000n);
    expect(snapshot.market.state.totalSupplyAssets).toBe(185_634_262n);
    expect(snapshot.account?.position.collateralAssets).toBe(10n ** 18n);
  });

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
    expect(snapshot.blockTimestamp).toBe(1_000n);
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
      tokens: {
        ethBalance: 3n * 10n ** 18n,
        wethBalance: 10n ** 18n,
        usdcBalance: 2_000_000n,
        usdcAllowance: 1_000_000n,
        morphoUsdcAllowance: 7n,
        morphoWethAllowance: 8n,
      },
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
    getBlock: async (request: { blockNumber: bigint }) => {
      expect(request.blockNumber).toBe(123n);
      return { timestamp: 1_000n };
    },
    getBalance: async (request: { address: Address; blockNumber?: bigint }) => {
      expect(request).toEqual({ address: account, blockNumber: 123n });
      return 3n * 10n ** 18n;
    },
    readContract: async (request: ReadRequest) => {
      calls.push(request);
      const { functionName } = request;
      if (functionName === "balanceOf") {
        if (request.address === config.weth) {
          expect(request.args).toEqual([account]);
          return 10n ** 18n;
        }
        expect(request.address).toBe(config.usdc);
        expect([account, config.adapter]).toContain(request.args?.[0]);
        return request.args?.[0] === config.adapter ? 500_001n : 2_000_000n;
      }
      if (functionName === "allowance") {
        expect(request.args?.[0]).toBe(account);
        if (request.address === config.weth) {
          expect(request.args?.[1]).toBe(config.morpho);
          return 8n;
        }
        expect(request.address).toBe(config.usdc);
        expect([config.morpho, config.wrapper]).toContain(request.args?.[1]);
        return request.args?.[1] === config.morpho ? 7n : 1_000_000n;
      }
      if (functionName === "position") {
        expect(request.address).toBe(config.morpho);
        expect(request.args?.[0]).toBe(config.marketId);
        expect([account, config.adapter]).toContain(request.args?.[1]);
        return request.args?.[1] === config.adapter
          ? [1_000_000_000_000n, 0n, 0n]
          : [50n, 25n, 10n ** 18n];
      }

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

      const adapterFunctions = [
        "usdc",
        "confidentialUsdc",
        "prizePool",
        "morpho",
        "marketId",
        "suppliedPrincipal",
        "idlePrincipal",
        "availablePrincipalAssets",
        "accruedYieldAssets",
        "suppliedAssets",
        "marketParams",
      ];
      const expectedAddress = adapterFunctions.includes(functionName)
        ? config.adapter
        : ["market", "idToMarketParams"].includes(functionName)
        ? config.morpho
        : functionName === "price"
        ? oracle
        : functionName === "borrowRateView"
        ? irm
        : functionName === "confidentialBalanceOf"
        ? config.wrapper
        : config.pool;
      expect(request.address).toBe(expectedAddress);
      if (["market", "idToMarketParams"].includes(functionName))
        expect(request.args).toEqual([config.marketId]);
      else if (functionName.startsWith("withdrawalBatch"))
        expect(request.args).toEqual([4n]);
      else if (
        [
          "encryptedPrincipalOf",
          "encryptedWinningsOf",
          "confidentialBalanceOf",
        ].includes(functionName)
      )
        expect(request.args).toEqual([account]);
      else if (functionName === "borrowRateView") {
        expect(request.args?.[0]).toMatchObject({
          loanToken: config.usdc,
          collateralToken: config.weth,
          oracle,
          irm,
        });
        expect(request.args?.[1]).toHaveProperty("totalBorrowAssets");
      } else expect(request.args).toBeUndefined();
      if (!Object.hasOwn(values, functionName))
        throw new Error(`Unexpected read: ${functionName}`);
      return Reflect.get(values, functionName);
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
