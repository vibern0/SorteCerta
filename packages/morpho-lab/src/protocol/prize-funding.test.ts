import {
  decodeAbiParameters,
  decodeFunctionData,
  getAddress,
  isHex,
  parseAbi,
  type Hex,
} from "viem";
import { describe, expect, it } from "vitest";
import { loadLabConfig } from "../config";
import type { AccountSnapshot, ProtocolSnapshot } from "../types";
import type { SimulatedWriteArgs } from "../wallet/MetaMaskProvider";
import { executePrizeFunding } from "./prize-funding";

const config = loadLabConfig({});
const account = getAddress("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd");
const handle = `0x${"ab".repeat(32)}` as Hex;
const selector = "0x12345678" as Hex;
const wrapperAbi = parseAbi([
  "function multicall(bytes[] data) returns (bytes[])",
  "function wrap(address to, uint256 amount)",
  "function confidentialTransferAndCall(address to, bytes32 amount, bytes proof, bytes data) returns (bytes32)",
]);

type TestSnapshot = ProtocolSnapshot & { account: AccountSnapshot };

function secondBigIntArg(call: SimulatedWriteArgs): bigint {
  const value = call.args?.[1];
  if (typeof value !== "bigint") throw new Error("Expected bigint argument");
  return value;
}

function hexPair(value: unknown): [Hex, Hex] {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    !isHex(value[0]) ||
    !isHex(value[1])
  ) {
    throw new Error("Expected two encoded calls");
  }
  return [value[0], value[1]];
}

function harness(allowance = 0n) {
  const calls: SimulatedWriteArgs[] = [];
  const params = {
    loanToken: config.usdc,
    collateralToken: config.weth,
    oracle: account,
    irm: account,
    lltv: 1n,
  };
  const state: TestSnapshot = {
    blockNumber: 1n,
    blockTimestamp: 1n,
    refreshedAt: 1,
    deployment: config,
    adapter: {
      usdc: config.usdc,
      confidentialUsdc: config.wrapper,
      prizePool: config.pool,
      morpho: config.morpho,
      marketId: config.marketId,
      marketParams: params,
      usdcBalance: 0n,
      supplyShares: 0n,
      backingDifference: 0n,
      suppliedPrincipal: 0n,
      idlePrincipal: 0n,
      availablePrincipalAssets: 0n,
      accruedYieldAssets: 0n,
      suppliedAssets: 0n,
    },
    market: {
      params,
      liquidity: 0n,
      oraclePrice: 1n,
      state: {
        totalSupplyAssets: 0n,
        totalSupplyShares: 0n,
        totalBorrowAssets: 0n,
        totalBorrowShares: 0n,
        lastUpdate: 1n,
        fee: 0n,
      },
    },
    pool: {
      publicPrizeReserve: 1n,
      drawId: 1n,
      nextDrawAt: 1n,
      participantCount: 0n,
      morphoPendingDepositCount: 0n,
      lastMorphoUnwrapAt: 0n,
      morphoUnwrapInterval: 0n,
      encryptedTotalPrincipalHandle: handle,
      encryptedPrizeReserveHandle: handle,
      encryptedPendingMorphoPrincipalHandle: handle,
      withdrawalBatch: {
        id: 1n,
        status: 0,
        closesAt: 1n,
        funded: false,
        restoredAmount: 0n,
        requestCount: 0n,
        claimantCount: 0n,
      },
    },
    account: {
      address: account,
      position: { supplyShares: 0n, borrowShares: 0n, collateralAssets: 0n },
      encryptedPrincipalHandle: handle,
      encryptedWinningsHandle: handle,
      tokens: {
        usdcBalance: 20_000_000n,
        usdcAllowance: allowance,
        ethBalance: 1n,
        wethBalance: 0n,
        morphoUsdcAllowance: 0n,
        morphoWethAllowance: 0n,
        confidentialUsdcHandle: handle,
      },
    },
  };
  const runner = {
    refresh: async () => state,
    submit: async (call: SimulatedWriteArgs) => {
      calls.push(call);
      if (call.functionName === "approve")
        state.account.tokens.usdcAllowance = secondBigIntArg(call);
    },
    encrypt: async (wrapper: string, user: string, amount: bigint) => {
      expect(wrapper).toBe(config.wrapper);
      expect(user).toBe(account);
      expect(amount).toBe(10_000_000n);
      return { handle, proof: "0xbeef" as Hex };
    },
    readFundingSelector: async (pool: string) => {
      expect(pool).toBe(config.pool);
      return selector;
    },
  };
  return { calls, state, runner };
}

describe("sponsor prize funding", () => {
  it("bounds wrapper approval and atomically wraps and transfers with the prize callback", async () => {
    const h = harness();
    await executePrizeFunding(
      config,
      account.toLowerCase() as typeof account,
      10_000_000n,
      h.runner
    );
    expect(h.calls).toHaveLength(2);
    expect(h.calls[0]).toMatchObject({
      address: config.usdc,
      functionName: "approve",
      args: [config.wrapper, 10_000_000n],
    });
    expect(h.calls[1]).toMatchObject({
      address: config.wrapper,
      functionName: "multicall",
    });
    const [wrap, transfer] = hexPair(h.calls.at(1)?.args?.at(0));
    expect(decodeFunctionData({ abi: wrapperAbi, data: wrap })).toMatchObject({
      functionName: "wrap",
      args: [account, 10_000_000n],
    });
    const decoded = decodeFunctionData({ abi: wrapperAbi, data: transfer });
    expect(decoded.functionName).toBe("confidentialTransferAndCall");
    expect(decoded.args.slice(0, 3)).toEqual([config.pool, handle, "0xbeef"]);
    const data = decoded.args[3];
    if (data === undefined) throw new Error("Expected callback data");
    expect(data.slice(0, 10)).toBe(selector);
    expect(
      decodeAbiParameters([{ type: "uint64" }], `0x${data.slice(10)}`)
    ).toEqual([10_000_000n]);
  });

  it("skips sufficient allowance", async () => {
    const h = harness(10_000_000n);
    await executePrizeFunding(config, account, 10_000_000n, h.runner);
    expect(h.calls.map((call) => call.functionName)).toEqual(["multicall"]);
  });

  it.each([0n, -1n, 21_000_000n, 2n ** 64n])(
    "rejects invalid funding amount %s before any write",
    async (amount) => {
      const h = harness();
      await expect(
        executePrizeFunding(config, account, amount, h.runner)
      ).rejects.toThrow(/amount|balance|range/i);
      expect(h.calls).toEqual([]);
    }
  );

  it.each(["cancel", "account", "binding", "allowance", "refresh", "reserve"])(
    "stops after approval on %s",
    async (failure) => {
      const h = harness();
      const submit = h.runner.submit;
      h.runner.submit = async (call) => {
        await submit(call);
        if (failure === "cancel") throw new Error("Transaction cancelled");
        if (failure === "account") h.state.account.address = config.usdc;
        if (failure === "binding")
          h.state.deployment = { ...config, wrapper: account };
        if (failure === "allowance") h.state.account.tokens.usdcAllowance = 0n;
        if (failure === "refresh")
          h.runner.refresh = async () => {
            throw new Error("Read failed");
          };
        if (failure === "reserve")
          h.state.pool.publicPrizeReserve = 2n ** 64n - 1n;
      };
      await expect(
        executePrizeFunding(config, account, 10_000_000n, h.runner)
      ).rejects.toThrow();
      expect(h.calls.map((call) => call.functionName)).toEqual(["approve"]);
    }
  );
});
