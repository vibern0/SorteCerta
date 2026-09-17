import { encodeFunctionData, getAddress, type Address } from "viem";
import { describe, expect, it } from "vitest";
import { loadLabConfig } from "../config";
import type { ProtocolSnapshot } from "../types";
import {
  buildApproval,
  buildBorrow,
  buildRepay,
  buildSupply,
  buildSupplyCollateral,
  buildUnwrap,
  buildWithdraw,
  buildWithdrawCollateral,
  buildWrap,
  createActionContext,
  executeAction,
  executeIncreaseUtilization,
  getActionMax,
  getIncreaseBorrowMax,
  getRepayAllQuote,
  parseAmount,
  validateAction,
  type ActionContext,
  type ActionKind,
} from "./actions";

const deployment = loadLabConfig({});
const account = getAddress("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd");
const params = {
  loanToken: deployment.usdc,
  collateralToken: deployment.weth,
  oracle: getAddress("0x2222222222222222222222222222222222222222"),
  irm: getAddress("0x3333333333333333333333333333333333333333"),
  lltv: 900_000_000_000_000_000n,
};

function snapshot(): ProtocolSnapshot {
  return {
    blockNumber: 123n,
    blockTimestamp: 1n,
    refreshedAt: 1,
    deployment,
    pool: {
      drawId: 1n,
      nextDrawAt: 1n,
      participantCount: 1n,
      publicPrizeReserve: 0n,
      morphoPendingDepositCount: 0n,
      lastMorphoUnwrapAt: 0n,
      morphoUnwrapInterval: 0n,
      encryptedTotalPrincipalHandle: "0x00",
      encryptedPrizeReserveHandle: "0x00",
      encryptedPendingMorphoPrincipalHandle: "0x00",
      withdrawalBatch: {
        id: 0n,
        status: 0,
        closesAt: 0n,
        funded: false,
        restoredAmount: 0n,
        requestCount: 0n,
        claimantCount: 0n,
      },
    },
    adapter: {
      usdcBalance: 0n,
      supplyShares: 0n,
      backingDifference: 0n,
      usdc: deployment.usdc,
      confidentialUsdc: deployment.wrapper,
      prizePool: deployment.pool,
      morpho: deployment.morpho,
      marketId: deployment.marketId,
      suppliedPrincipal: 0n,
      idlePrincipal: 0n,
      availablePrincipalAssets: 0n,
      accruedYieldAssets: 0n,
      suppliedAssets: 0n,
      marketParams: params,
    },
    market: {
      liquidity: 9_000_000_000n,
      params,
      oraclePrice: 2_000n * 10n ** 24n,
      utilizationWad: 0n,
      borrowRatePerSecond: 0n,
      state: {
        totalSupplyAssets: 10_000_000_000n,
        totalSupplyShares: 10_000_000_000_000_000n,
        totalBorrowAssets: 1_000_000_000n,
        totalBorrowShares: 1_000_000_000_000_000n,
        lastUpdate: 1n,
        fee: 0n,
      },
    },
    account: {
      address: account,
      position: {
        supplyShares: 2_000_000_000_000_000n,
        borrowShares: 500_000_000_000_000n,
        collateralAssets: 10n ** 18n,
      },
      health: {
        collateralValue: 2_000_000_000n,
        borrowLimit: 1_800_000_000n,
        borrowAssets: 500_000_000n,
        liquidatable: false,
      },
      tokens: {
        ethBalance: 2n * 10n ** 18n,
        wethBalance: 2n * 10n ** 18n,
        usdcBalance: 2_000_000_000n,
        usdcAllowance: 0n,
        morphoUsdcAllowance: 0n,
        morphoWethAllowance: 0n,
        confidentialUsdcHandle: "0x00",
      },
      encryptedPrincipalHandle: "0x00",
      encryptedWinningsHandle: "0x00",
    },
  };
}

function context(state = snapshot()) {
  return createActionContext(deployment, state);
}

describe("action builders", () => {
  it("borrows assets to and on behalf of the account using adapter parameters", () => {
    const config = context();
    expect(buildBorrow(config, account, 1_000_000n)).toMatchObject({
      address: config.morpho,
      functionName: "borrow",
      args: [expect.any(Object), 1_000_000n, 0n, account, account],
    });
    expect(buildBorrow(config, account, 1_000_000n).args[0]).toEqual(params);
  });

  it("encodes supply, repay, withdrawal and collateral arguments in the right direction", () => {
    const config = context();
    const calls = [
      [
        buildSupply(config, account, 7n),
        "supply",
        [params, 7n, 0n, account, "0x"],
      ],
      [
        buildRepay(config, account, 7n),
        "repay",
        [params, 7n, 0n, account, "0x"],
      ],
      [
        buildWithdraw(config, account, 7n),
        "withdraw",
        [params, 7n, 0n, account, account],
      ],
      [
        buildSupplyCollateral(config, account, 7n),
        "supplyCollateral",
        [params, 7n, account, "0x"],
      ],
      [
        buildWithdrawCollateral(config, account, 7n),
        "withdrawCollateral",
        [params, 7n, account, account],
      ],
    ] as const;
    for (const [call, functionName, args] of calls) {
      expect(call).toMatchObject({
        address: config.morpho,
        functionName,
        args,
      });
      expect(encodeFunctionData(call)).toMatch(/^0x[0-9a-f]+$/);
    }
  });

  it("approves only the action amount to Morpho for either token", () => {
    for (const token of ["usdc", "weth"] as const) {
      expect(buildApproval(context(), token, 13n)).toMatchObject({
        address: deployment[token],
        functionName: "approve",
        args: [deployment.morpho, 13n],
      });
    }
  });

  it("uses borrow shares for repay-all and supply shares for withdraw-all", () => {
    const config = context();
    expect(buildRepay(config, account, "all").args).toEqual([
      params,
      0n,
      500_000_000_000_000n,
      account,
      "0x",
    ]);
    expect(buildWithdraw(config, account, "all").args).toEqual([
      params,
      0n,
      2_000_000_000_000_000n,
      account,
      account,
    ]);
  });

  it("wraps with payable deposit and unwraps with withdraw(uint256)", () => {
    expect(buildWrap(context(), 12n)).toMatchObject({
      address: deployment.weth,
      functionName: "deposit",
      args: [],
      value: 12n,
    });
    expect(buildUnwrap(context(), 12n)).toMatchObject({
      address: deployment.weth,
      functionName: "withdraw",
      args: [12n],
    });
    expect(encodeFunctionData(buildWrap(context(), 12n))).toBe("0xd0e30db0");
    expect(encodeFunctionData(buildUnwrap(context(), 12n))).toBe(
      `0x2e1a7d4d${"c".padStart(64, "0")}`
    );
  });

  it("normalizes account and adapter addresses", () => {
    const state = snapshot();
    state.adapter.marketParams = {
      ...params,
      oracle: account.toLowerCase() as Address,
    };
    state.market.params = state.adapter.marketParams;
    const call = buildBorrow(
      context(state),
      account.toLowerCase() as Address,
      1n
    );
    expect(call.args[0].oracle).toBe(account);
    expect(call.args[3]).toBe(account);
  });

  it("refuses inconsistent deployment and account bindings", () => {
    const state = snapshot();
    state.deployment = { ...deployment, adapter: account };
    expect(() => context(state)).toThrow(/binding|adapter/i);
    expect(() => buildBorrow(context(), params.oracle, 1n)).toThrow(/account/i);
  });
});

describe("local validation", () => {
  it("reduces borrowing and collateral withdrawal maxima for idle-market interest", () => {
    const state = snapshot();
    const oldCollateralMax = getActionMax(context(state), "withdrawCollateral");
    state.blockTimestamp = 1_001n;
    state.market.borrowRatePerSecond = 1_000_000_000_000n;
    expect(getActionMax(context(state), "borrowUsdc")).toBe(939_499_750n);
    expect(getIncreaseBorrowMax(context(state), 10n ** 18n)).toBe(
      2_379_499_750n
    );
    expect(() =>
      validateAction(context(state), "borrowUsdc", 940_000_000n)
    ).toThrow(/safety/i);
    expect(() =>
      validateAction(context(state), "withdrawCollateral", oldCollateralMax)
    ).toThrow(/healthy/i);
    expect(state.market.state.totalBorrowAssets).toBe(1_000_000_000n);
  });

  it("blocks risk-increasing actions when pending interest cannot be estimated", () => {
    const state = snapshot();
    state.blockTimestamp = 100n;
    state.market.borrowRatePerSecond = undefined;
    expect(() => validateAction(context(state), "borrowUsdc", 1n)).toThrow(
      /rate/i
    );
    expect(() =>
      validateAction(context(state), "withdrawCollateral", 1n)
    ).toThrow(/rate/i);
  });

  it("allows independent balance-improving actions when borrow rate is unavailable", () => {
    const state = snapshot();
    state.blockTimestamp = 100n;
    state.market.borrowRatePerSecond = undefined;

    expect(getActionMax(context(state), "wrapEth")).toBe(
      state.account!.tokens.ethBalance - 10n ** 15n
    );
    expect(getActionMax(context(state), "unwrapWeth")).toBe(
      state.account!.tokens.wethBalance
    );
    expect(getActionMax(context(state), "supplyUsdc")).toBe(
      state.account!.tokens.usdcBalance
    );
    expect(getActionMax(context(state), "supplyCollateral")).toBe(
      state.account!.tokens.wethBalance
    );

    expect(() => validateAction(context(state), "wrapEth", 1n)).not.toThrow();
    expect(() => validateAction(context(state), "unwrapWeth", 1n)).not.toThrow();
    expect(() => validateAction(context(state), "supplyUsdc", 1n)).not.toThrow();
    expect(() =>
      validateAction(context(state), "supplyCollateral", 1n)
    ).not.toThrow();
  });

  it.each<ActionKind>([
    "wrapEth",
    "unwrapWeth",
    "supplyUsdc",
    "withdrawUsdc",
    "supplyCollateral",
    "borrowUsdc",
    "repayUsdc",
    "withdrawCollateral",
  ])("rejects zero and negative %s amounts", (action) => {
    expect(() => validateAction(context(), action, 0n)).toThrow(/positive/i);
    expect(() => validateAction(context(), action, -1n)).toThrow(/positive/i);
  });

  it("rejects excess precision instead of rounding the amount", () => {
    expect(parseAmount("1.000001", 6)).toBe(1_000_001n);
    for (const value of ["1.0000001", "-1", "1e3", "", ".", "NaN"]) {
      expect(() => parseAmount(value, 6)).toThrow();
    }
  });

  it("enforces the default and configured safety margin", () => {
    expect(getActionMax(context(), "borrowUsdc")).toBe(940_000_000n);
    expect(() => validateAction(context(), "borrowUsdc", 940_000_001n)).toThrow(
      /safety/i
    );
    expect(() =>
      validateAction(context(), "borrowUsdc", 940_000_000n)
    ).not.toThrow();
    const config = createActionContext(deployment, snapshot(), 5_000n);
    expect(getActionMax(config, "borrowUsdc")).toBe(400_000_000n);
  });

  it("rejects collateral withdrawals that leave unhealthy debt, allowing safe boundaries", () => {
    expect(() =>
      validateAction(context(), "withdrawCollateral", 800_000_000_000_000_000n)
    ).toThrow(/healthy/i);
    expect(() =>
      validateAction(context(), "withdrawCollateral", 500_000_000_000_000_000n)
    ).not.toThrow();
    const max = getActionMax(context(), "withdrawCollateral");
    expect(() =>
      validateAction(context(), "withdrawCollateral", max)
    ).not.toThrow();
    expect(() =>
      validateAction(context(), "withdrawCollateral", max + 1n)
    ).toThrow();
  });

  it.each<ActionKind>([
    "wrapEth",
    "unwrapWeth",
    "supplyUsdc",
    "supplyCollateral",
    "withdrawUsdc",
    "repayUsdc",
    "withdrawCollateral",
  ])("rejects %s above balance/position", (action) => {
    expect(() =>
      validateAction(context(), action, 100_000n * 10n ** 18n)
    ).toThrow();
  });

  it("rejects borrowing and direct withdrawals above market liquidity", () => {
    const state = snapshot();
    state.market.state.totalBorrowAssets = 9_999_999_999n;
    state.account!.position.borrowShares = 0n;
    for (const action of ["borrowUsdc", "withdrawUsdc"] as const) {
      expect(() => validateAction(context(state), action, 2n)).toThrow(
        /liquidity/i
      );
    }
    expect(() => validateAction(context(state), "withdrawUsdc", "all")).toThrow(
      /liquidity/i
    );
  });

  it("does not turn repay-all into a partial repayment when balance is insufficient", () => {
    const state = snapshot();
    state.account!.tokens.usdcBalance = 1n;
    expect(() => validateAction(context(state), "repayUsdc", "all")).toThrow(
      /balance/i
    );
  });

  it("allows removing all supply shares even when they round down to zero assets", () => {
    const state = snapshot();
    state.account!.position.supplyShares = 1n;
    expect(() =>
      validateAction(context(state), "withdrawUsdc", "all")
    ).not.toThrow();
    expect(buildWithdraw(context(state), account, "all").args).toEqual([
      params,
      0n,
      1n,
      account,
      account,
    ]);
  });

  it("rounds partial repay max down while allowing a full share repayment to round up", () => {
    const state = snapshot();
    state.account!.position.borrowShares = 1_000_001n;
    state.market.state.totalBorrowAssets = 2n;
    state.market.state.totalBorrowShares = 1_000_002n;
    expect(getActionMax(context(state), "repayUsdc")).toBe(1n);
    expect(() => validateAction(context(state), "repayUsdc", 2n)).toThrow();
    expect(() =>
      validateAction(context(state), "repayUsdc", "all")
    ).not.toThrow();
  });

  it("caps guided borrowing by projected collateral, existing debt and market liquidity", () => {
    expect(getIncreaseBorrowMax(context(), 10n ** 18n)).toBe(2_380_000_000n);
    const state = snapshot();
    state.market.state.totalSupplyAssets = 1_000_000_005n;
    expect(getIncreaseBorrowMax(context(state), 10n ** 18n)).toBe(5n);
  });
});

describe("transaction sequences", () => {
  function harness(failAt?: string, approved = false) {
    const state = snapshot();
    if (approved) state.account!.tokens.morphoWethAllowance = 10n ** 18n;
    const events: string[] = [];
    const refresh = async () => {
      events.push("refresh");
      return context(state);
    };
    const submit = async (call: {
      address: Address;
      functionName: string;
      args?: readonly unknown[];
    }) => {
      events.push(call.functionName);
      if (call.functionName === failAt) throw new Error("Rejected");
      if (call.functionName === "approve") {
        state.account!.tokens[
          call.address === deployment.usdc
            ? "morphoUsdcAllowance"
            : "morphoWethAllowance"
        ] = call.args![1] as bigint;
      }
      if (call.functionName === "supplyCollateral") {
        state.account!.position.collateralAssets += call.args![1] as bigint;
        state.account!.tokens.wethBalance -= call.args![1] as bigint;
      }
      if (call.functionName === "repay")
        state.account!.position.borrowShares = 0n;
    };
    return { state, events, refresh, submit };
  }

  it("refreshes between approval, collateral supply and borrowing", async () => {
    const h = harness();
    await executeIncreaseUtilization(
      context(h.state),
      10n ** 18n,
      2_000_000_000n,
      h
    );
    expect(h.events).toEqual([
      "refresh",
      "approve",
      "refresh",
      "supplyCollateral",
      "refresh",
      "borrow",
      "refresh",
    ]);
  });

  it("skips WETH approval when already sufficient", async () => {
    const h = harness(undefined, true);
    await executeIncreaseUtilization(context(h.state), 10n ** 18n, 1n, h);
    expect(h.events).toEqual([
      "refresh",
      "supplyCollateral",
      "refresh",
      "borrow",
      "refresh",
    ]);
  });

  it.each(["approve", "supplyCollateral", "borrow"])(
    "stops immediately when %s fails",
    async (step) => {
      const h = harness(step);
      await expect(
        executeIncreaseUtilization(context(h.state), 10n ** 18n, 1n, h)
      ).rejects.toThrow("Rejected");
      expect(h.events.at(-1)).toBe(step);
    }
  );

  it("does not request approval when the planned borrow is already invalid", async () => {
    const h = harness();
    await expect(
      executeIncreaseUtilization(
        context(h.state),
        10n ** 18n,
        3_000_000_000n,
        h
      )
    ).rejects.toThrow();
    expect(h.events.filter((event) => event !== "refresh")).toEqual([]);
  });

  it("stops on refresh failure and account changes between steps", async () => {
    for (const reason of ["failure", "account"]) {
      const h = harness();
      let reads = 0;
      const refresh = async (): Promise<ActionContext> => {
        if (++reads > 1) {
          if (reason === "failure") throw new Error("Refresh failed");
          h.state.account!.address = params.oracle;
        }
        return h.refresh();
      };
      await expect(
        executeIncreaseUtilization(context(h.state), 10n ** 18n, 1n, {
          ...h,
          refresh,
        })
      ).rejects.toThrow();
      expect(h.events).not.toContain("supplyCollateral");
    }
  });

  it("guards independent actions before submitting any transaction", async () => {
    const h = harness();
    await expect(
      executeAction(context(h.state), "borrowUsdc", 2_000_000_000n, h)
    ).rejects.toThrow();
    expect(h.events).toEqual(["refresh"]);
  });

  it("approves direct supply and share-based debt repayment only when missing", async () => {
    for (const [action, amount, name] of [
      ["supplyUsdc", 10n, "supply"],
      ["repayUsdc", "all", "repay"],
    ] as const) {
      const h = harness();
      await executeAction(
        context(h.state),
        action,
        amount,
        h,
        amount === "all"
          ? {
              borrowShares: h.state.account!.position.borrowShares,
              approvalAmount: 500_000_000n,
            }
          : undefined
      );
      expect(h.events).toEqual([
        "refresh",
        "approve",
        "refresh",
        name,
        "refresh",
      ]);
      expect(h.state.account!.tokens.morphoUsdcAllowance).toBe(
        amount === "all" ? 500_000_000n : 10n
      );
    }
  });

  it("stops after collateral supply when refreshed liquidity cannot cover the borrow", async () => {
    const h = harness();
    const submit = async (call: Parameters<typeof h.submit>[0]) => {
      await h.submit(call);
      if (call.functionName === "supplyCollateral")
        h.state.market.state.totalSupplyAssets = 1_000_000_000n;
    };
    await expect(
      executeIncreaseUtilization(context(h.state), 10n ** 18n, 1n, {
        ...h,
        submit,
      })
    ).rejects.toThrow(/liquidity/i);
    expect(h.events).toEqual([
      "refresh",
      "approve",
      "refresh",
      "supplyCollateral",
      "refresh",
    ]);
  });

  it("stops if accrued repay-all debt now exceeds the exact approval", async () => {
    const h = harness();
    const submit = async (call: Parameters<typeof h.submit>[0]) => {
      await h.submit(call);
      if (call.functionName === "approve")
        h.state.market.state.totalBorrowAssets += 2n;
    };
    await expect(
      executeAction(
        context(h.state),
        "repayUsdc",
        "all",
        { ...h, submit },
        {
          borrowShares: h.state.account!.position.borrowShares,
          approvalAmount: 500_000_000n,
        }
      )
    ).rejects.toThrow(/approval/i);
    expect(h.events).toEqual(["refresh", "approve", "refresh"]);
  });
});

describe("reviewed repay-all with pending interest", () => {
  it("quotes accrued debt even while stored totals stay unchanged", () => {
    const state = snapshot();
    state.blockTimestamp = 1_001n;
    state.market.borrowRatePerSecond = 1_000_000_000_000n;
    expect(getRepayAllQuote(context(state))).toMatchObject({
      estimatedAssets: 500_500_250n,
      suggestedApproval: 505_505_253n,
      maxApproval: 550_550_275n,
      borrowShares: 500_000_000_000_000n,
    });
    expect(state.market.state.totalBorrowAssets).toBe(1_000_000_000n);
    state.blockTimestamp = 1_601n;
    expect(getRepayAllQuote(context(state)).estimatedAssets).toBe(500_800_640n);
  });

  it("repays to zero borrow shares after time advances between review, approval and repayment", async () => {
    const state = snapshot();
    state.blockTimestamp = 1_001n;
    state.market.borrowRatePerSecond = 1_000_000_000_000n;
    const calls: string[] = [];
    const review = {
      borrowShares: 500_000_000_000_000n,
      approvalAmount: 505_505_253n,
    };
    await executeAction(
      context(state),
      "repayUsdc",
      "all",
      {
        refresh: async () => context(state),
        submit: async (call) => {
          calls.push(call.functionName);
          if (call.functionName === "approve") {
            expect(call.args).toEqual([deployment.morpho, 505_505_253n]);
            state.account!.tokens.morphoUsdcAllowance = call.args![1] as bigint;
            state.blockTimestamp = 1_601n;
            // No market interaction: stored totals and lastUpdate still do not accrue.
            expect(state.market.state.totalBorrowAssets).toBe(1_000_000_000n);
          } else {
            expect(call.functionName).toBe("repay");
            expect(call.args).toEqual([
              params,
              0n,
              500_000_000_000_000n,
              account,
              "0x",
            ]);
            // At t=1601, Morpho's pending interest increases the repayment to 500800640.
            if (state.account!.tokens.morphoUsdcAllowance < 500_800_640n)
              throw new Error("ERC20InsufficientAllowance");
            state.account!.tokens.usdcBalance -= 500_800_640n;
            state.account!.tokens.morphoUsdcAllowance -= 500_800_640n;
            state.account!.position.borrowShares = 0n;
          }
        },
      },
      review
    );
    expect(calls).toEqual(["approve", "repay"]);
    expect(state.account!.position.borrowShares).toBe(0n);
    expect(state.account!.tokens.usdcBalance).toBe(1_499_199_360n);
  });

  it("requires a reviewed bound and rejects unlimited, over-balance or insufficient limits before writing", async () => {
    for (const approvalAmount of [
      undefined,
      2n ** 256n - 1n,
      600_000_000n,
      499_999_999n,
    ]) {
      let writes = 0;
      const state = snapshot();
      await expect(
        executeAction(
          context(state),
          "repayUsdc",
          "all",
          {
            refresh: async () => context(state),
            submit: async () => {
              writes++;
            },
          },
          approvalAmount === undefined
            ? undefined
            : {
                borrowShares: state.account!.position.borrowShares,
                approvalAmount,
              }
        )
      ).rejects.toThrow(/review|limit|approval/i);
      expect(writes).toBe(0);
    }
  });

  it("fails closed if the interest rate is unavailable", () => {
    const state = snapshot();
    state.market.borrowRatePerSecond = undefined;
    expect(() => getRepayAllQuote(context(state))).toThrow(/rate/i);
  });

  it("stops rather than silently increasing the reviewed limit after a long delay", async () => {
    const state = snapshot();
    state.market.borrowRatePerSecond = 1_000_000_000_000n;
    const writes: string[] = [];
    await expect(
      executeAction(
        context(state),
        "repayUsdc",
        "all",
        {
          refresh: async () => context(state),
          submit: async (call) => {
            writes.push(call.functionName);
            state.account!.tokens.morphoUsdcAllowance = call.args![1] as bigint;
            state.blockTimestamp = 100_001n;
          },
        },
        {
          borrowShares: state.account!.position.borrowShares,
          approvalAmount: 505_000_000n,
        }
      )
    ).rejects.toThrow(/limit|approval/i);
    expect(writes).toEqual(["approve"]);
  });
});
