import { formatUnits, getAddress, type Address } from "viem";
import {
  accruedMarketState,
  erc20Abi,
  morphoBlueAbi,
  positionHealth,
  safeBorrowCapacity,
  sameMarketParams,
  toBorrowAssetsUp,
  toMarketParams,
  toSupplyAssetsDown,
  WAD,
  wethAbi,
} from "@sortecerta/protocol";
export { parseAmount } from "@sortecerta/protocol";
import type { LabConfig } from "../config";
import type {
  AccountSnapshot,
  ProtocolSnapshot,
} from "../types";
import type { SimulatedWriteArgs } from "../wallet/MetaMaskProvider";

export type ActionKind =
  | "wrapEth"
  | "unwrapWeth"
  | "supplyUsdc"
  | "withdrawUsdc"
  | "supplyCollateral"
  | "borrowUsdc"
  | "repayUsdc"
  | "withdrawCollateral";
export type ActionAmount = bigint | "all";
export type RepayAllReview = { borrowShares: bigint; approvalAmount: bigint };
export type ActionContext = LabConfig & {
  snapshot: ProtocolSnapshot & { account: AccountSnapshot };
  safetyBps: bigint;
};
export const ETH_GAS_RESERVE = 10n ** 15n;

export function actionLabel(action: ActionKind): string {
  switch (action) {
    case "wrapEth":
      return "Wrap ETH";
    case "unwrapWeth":
      return "Unwrap WETH";
    case "supplyUsdc":
      return "Supply USDC";
    case "withdrawUsdc":
      return "Withdraw USDC";
    case "supplyCollateral":
      return "Supply WETH collateral";
    case "borrowUsdc":
      return "Borrow USDC";
    case "repayUsdc":
      return "Repay USDC";
    case "withdrawCollateral":
      return "Withdraw WETH collateral";
  }
}

export function createActionContext(
  config: LabConfig,
  snapshot: ProtocolSnapshot,
  safetyBps = 8_000n
): ActionContext {
  if (safetyBps <= 0n || safetyBps > 8_000n)
    throw new Error("Safety margin must be at most 80% of LLTV.");
  assertAccountSnapshot(snapshot);
  const normalized = {
    ...config,
    usdc: getAddress(config.usdc),
    weth: getAddress(config.weth),
    wrapper: getAddress(config.wrapper),
    pool: getAddress(config.pool),
    adapter: getAddress(config.adapter),
    morpho: getAddress(config.morpho),
  };
  if (
    getAddress(snapshot.deployment.usdc) !== normalized.usdc ||
    getAddress(snapshot.deployment.weth) !== normalized.weth ||
    getAddress(snapshot.deployment.wrapper) !== normalized.wrapper ||
    getAddress(snapshot.deployment.pool) !== normalized.pool ||
    getAddress(snapshot.deployment.adapter) !== normalized.adapter ||
    getAddress(snapshot.deployment.morpho) !== normalized.morpho
  ) {
    throw new Error("Deployment binding changed. Refresh before continuing.");
  }
  const params = toMarketParams(snapshot.adapter.marketParams);
  const registered = toMarketParams(snapshot.market.params);
  if (
    snapshot.deployment.marketId !== config.marketId ||
    snapshot.adapter.marketId !== config.marketId ||
    getAddress(snapshot.adapter.morpho) !== normalized.morpho ||
    getAddress(snapshot.adapter.prizePool) !== normalized.pool ||
    getAddress(snapshot.adapter.usdc) !== normalized.usdc ||
    getAddress(snapshot.adapter.confidentialUsdc) !== normalized.wrapper ||
    params.loanToken !== normalized.usdc ||
    params.collateralToken !== normalized.weth ||
    !sameMarketParams(params, registered)
  ) {
    throw new Error(
      "Adapter market binding changed. Refresh before continuing."
    );
  }
  return { ...normalized, snapshot, safetyBps };
}

function assertAccountSnapshot(
  snapshot: ProtocolSnapshot,
): asserts snapshot is ProtocolSnapshot & { account: AccountSnapshot } {
  if (!snapshot.account) throw new Error("Connect MetaMask before continuing.");
}

function owner(config: ActionContext, address?: Address) {
  const account = config.snapshot.account;
  if (address && getAddress(address) !== getAddress(account.address))
    throw new Error("Account changed. Review the action again.");
  return getAddress(account.address);
}

function market(config: ActionContext) {
  return { address: getAddress(config.morpho), abi: morphoBlueAbi } as const;
}

function marketParams(config: ActionContext) {
  const { loanToken, collateralToken, oracle, irm, lltv } = toMarketParams(
    config.snapshot.adapter.marketParams,
  );
  return { loanToken, collateralToken, oracle, irm, lltv };
}

export function buildApproval(
  config: ActionContext,
  token: "usdc" | "weth",
  amount: bigint
) {
  positive(amount);
  return {
    address: getAddress(token === "usdc" ? config.usdc : config.weth),
    abi: erc20Abi,
    functionName: "approve",
    args: [getAddress(config.morpho), amount],
    summary: `Approve ${formatUnits(
      amount,
      token === "usdc" ? 6 : 18
    )} ${token.toUpperCase()} for Morpho`,
  } as const;
}

export function buildWrap(config: ActionContext, amount: bigint) {
  positive(amount);
  return {
    address: getAddress(config.weth),
    abi: wethAbi,
    functionName: "deposit",
    args: [],
    value: amount,
    summary: `Wrap ${formatUnits(amount, 18)} ETH`,
  } as const;
}

export function buildUnwrap(config: ActionContext, amount: bigint) {
  positive(amount);
  return {
    address: getAddress(config.weth),
    abi: wethAbi,
    functionName: "withdraw",
    args: [amount],
    summary: `Unwrap ${formatUnits(amount, 18)} WETH`,
  } as const;
}

export function buildSupply(
  config: ActionContext,
  account: Address,
  amount: bigint
) {
  positive(amount);
  return {
    ...market(config),
    functionName: "supply",
    args: [marketParams(config), amount, 0n, owner(config, account), "0x"],
    summary: `Supply ${formatUnits(amount, 6)} USDC`,
  } as const;
}

export function buildWithdraw(
  config: ActionContext,
  account: Address,
  amount: ActionAmount
) {
  const address = owner(config, account);
  const shares =
    amount === "all" ? config.snapshot.account.position.supplyShares : 0n;
  positive(amount === "all" ? shares : amount);
  return {
    ...market(config),
    functionName: "withdraw",
    args: [
      marketParams(config),
      amount === "all" ? 0n : amount,
      shares,
      address,
      address,
    ],
    summary:
      amount === "all"
        ? "Withdraw all USDC supply shares"
        : `Withdraw ${formatUnits(amount, 6)} USDC`,
  } as const;
}

export function buildSupplyCollateral(
  config: ActionContext,
  account: Address,
  amount: bigint
) {
  positive(amount);
  return {
    ...market(config),
    functionName: "supplyCollateral",
    args: [marketParams(config), amount, owner(config, account), "0x"],
    summary: `Supply ${formatUnits(amount, 18)} WETH collateral`,
  } as const;
}

export function buildBorrow(
  config: ActionContext,
  account: Address,
  amount: bigint
) {
  positive(amount);
  const address = owner(config, account);
  return {
    ...market(config),
    functionName: "borrow",
    args: [marketParams(config), amount, 0n, address, address],
    summary: `Borrow ${formatUnits(amount, 6)} USDC`,
  } as const;
}

export function buildRepay(
  config: ActionContext,
  account: Address,
  amount: ActionAmount
) {
  const address = owner(config, account);
  const shares =
    amount === "all" ? config.snapshot.account.position.borrowShares : 0n;
  positive(amount === "all" ? shares : amount);
  return {
    ...market(config),
    functionName: "repay",
    args: [
      marketParams(config),
      amount === "all" ? 0n : amount,
      shares,
      address,
      "0x",
    ],
    summary:
      amount === "all"
        ? "Repay all USDC borrow shares"
        : `Repay ${formatUnits(amount, 6)} USDC`,
  } as const;
}

export function buildWithdrawCollateral(
  config: ActionContext,
  account: Address,
  amount: bigint
) {
  positive(amount);
  const address = owner(config, account);
  return {
    ...market(config),
    functionName: "withdrawCollateral",
    args: [marketParams(config), amount, address, address],
    summary: `Withdraw ${formatUnits(amount, 18)} WETH collateral`,
  } as const;
}

function positive(amount: bigint) {
  if (amount <= 0n) throw new Error("Enter a positive amount.");
}
function min(a: bigint, b: bigint) {
  return a < b ? a : b;
}
function nonnegative(value: bigint) {
  return value > 0n ? value : 0n;
}
function ceilDiv(a: bigint, b: bigint) {
  return (a + b - 1n) / b;
}

export function positionAmounts(config: ActionContext) {
  owner(config);
  const { position } = config.snapshot.account;
  const state = accruedMarketState(
    config.snapshot.market.state,
    config.snapshot.market.borrowRatePerSecond,
    config.snapshot.blockTimestamp
  );
  return {
    supply: toSupplyAssetsDown(
      position.supplyShares,
      state.totalSupplyAssets,
      state.totalSupplyShares
    ),
    debt: toBorrowAssetsUp(
      position.borrowShares,
      state.totalBorrowAssets,
      state.totalBorrowShares
    ),
    liquidity: nonnegative(state.totalSupplyAssets - state.totalBorrowAssets),
  };
}

function marketLiquidity(config: ActionContext) {
  return positionAmounts(config).liquidity;
}

function directSupply(config: ActionContext) {
  return positionAmounts(config).supply;
}

function debtAssets(config: ActionContext) {
  return positionAmounts(config).debt;
}

function borrowCapacity(config: ActionContext, extraCollateral = 0n) {
  const health = positionHealth({
    collateralAssets:
      config.snapshot.account.position.collateralAssets + extraCollateral,
    collateralPrice: config.snapshot.market.oraclePrice,
    borrowAssets: debtAssets(config),
    lltv: config.snapshot.adapter.marketParams.lltv,
  });
  return safeBorrowCapacity(
    health,
    (config.snapshot.adapter.marketParams.lltv * config.safetyBps) / 10_000n
  );
}

export function getIncreaseBorrowMax(
  config: ActionContext,
  collateral: bigint
) {
  owner(config);
  return min(
    borrowCapacity(config, collateral),
    marketLiquidity(config)
  );
}

export function getActionMax(
  config: ActionContext,
  action: ActionKind
): bigint {
  owner(config);
  const { tokens, position } = config.snapshot.account;
  switch (action) {
    case "wrapEth":
      return nonnegative(tokens.ethBalance - ETH_GAS_RESERVE);
    case "unwrapWeth":
    case "supplyCollateral":
      return tokens.wethBalance;
    case "supplyUsdc":
      return tokens.usdcBalance;
    case "withdrawUsdc":
      return min(directSupply(config), marketLiquidity(config));
    case "borrowUsdc":
      return min(borrowCapacity(config), marketLiquidity(config));
    case "repayUsdc": {
      const state = accruedMarketState(
        config.snapshot.market.state,
        config.snapshot.market.borrowRatePerSecond,
        config.snapshot.blockTimestamp
      );
      // Asset-based repayment must not burn more borrow shares than owned.
      const repayAssets = toSupplyAssetsDown(
        position.borrowShares,
        state.totalBorrowAssets,
        state.totalBorrowShares
      );
      return min(repayAssets, tokens.usdcBalance);
    }
    case "withdrawCollateral": {
      const debt = debtAssets(config);
      if (debt === 0n) return position.collateralAssets;
      const { oraclePrice } = config.snapshot.market;
      const { lltv } = config.snapshot.adapter.marketParams;
      if (oraclePrice <= 0n || lltv <= 0n) return 0n;
      // Invert both floor divisions in the LLTV health check, rounding up.
      const required = ceilDiv(
        ceilDiv(debt * WAD, lltv) * 10n ** 36n,
        oraclePrice
      );
      return nonnegative(position.collateralAssets - required);
    }
  }
}

export function actionAssets(
  config: ActionContext,
  action: ActionKind,
  amount: ActionAmount
): bigint {
  if (amount !== "all") return amount;
  if (action === "repayUsdc") return getRepayAllQuote(config).estimatedAssets;
  if (action === "withdrawUsdc") return directSupply(config);
  throw new Error(
    "All shares applies only to debt repayment or direct supply withdrawal."
  );
}

export function validateAction(
  config: ActionContext,
  action: ActionKind,
  amount: ActionAmount
): void {
  owner(config);
  const assets = actionAssets(config, action, amount);
  if (amount === "all") {
    const { position } = config.snapshot.account;
    positive(
      action === "repayUsdc"
        ? position.borrowShares
        : position.supplyShares,
    );
  } else positive(assets);
  if (
    (action === "borrowUsdc" || action === "withdrawUsdc") &&
    assets > marketLiquidity(config)
  ) {
    throw new Error("Amount exceeds market liquidity.");
  }
  const max =
    amount === "all" && action === "repayUsdc"
      ? min(assets, config.snapshot.account.tokens.usdcBalance)
      : getActionMax(config, action);
  if (assets > max) {
    if (action === "borrowUsdc")
      throw new Error("Amount exceeds the borrowing safety margin.");
    if (action === "withdrawCollateral")
      throw new Error(
        "Withdrawal exceeds collateral or leaves an unhealthy position."
      );
    throw new Error(
      "Amount exceeds available balance or position. ETH wrapping reserves 0.001 ETH for fees."
    );
  }
}

export function requiredApproval(
  config: ActionContext,
  action: ActionKind,
  amount: ActionAmount
) {
  const assets = actionAssets(config, action, amount);
  const tokens = config.snapshot.account.tokens;
  if (action === "supplyCollateral")
    return {
      token: "weth" as const,
      amount: assets,
      allowance: tokens.morphoWethAllowance,
    };
  if (action === "supplyUsdc" || action === "repayUsdc")
    return {
      token: "usdc" as const,
      amount: assets,
      allowance: tokens.morphoUsdcAllowance,
    };
  return undefined;
}

export function buildAction(
  config: ActionContext,
  action: ActionKind,
  amount: ActionAmount
): SimulatedWriteArgs {
  validateAction(config, action, amount);
  const account = owner(config);
  const assets = actionAssets(config, action, amount);
  switch (action) {
    case "wrapEth":
      return buildWrap(config, assets);
    case "unwrapWeth":
      return buildUnwrap(config, assets);
    case "supplyUsdc":
      return buildSupply(config, account, assets);
    case "withdrawUsdc":
      return buildWithdraw(config, account, amount);
    case "supplyCollateral":
      return buildSupplyCollateral(config, account, assets);
    case "borrowUsdc":
      return buildBorrow(config, account, assets);
    case "repayUsdc":
      return buildRepay(config, account, amount);
    case "withdrawCollateral":
      return buildWithdrawCollateral(config, account, assets);
  }
}

export type ActionRunner = {
  refresh: () => Promise<ActionContext>;
  submit: (call: SimulatedWriteArgs) => Promise<unknown>;
  onStep?(message: string): void;
};

export function getRepayAllQuote(config: ActionContext) {
  owner(config);
  const { state, borrowRatePerSecond } = config.snapshot.market;
  const { position, tokens } = config.snapshot.account;
  if (borrowRatePerSecond === undefined)
    throw new Error(
      "Borrow rate unavailable. Refresh before reviewing repayment."
    );
  const totalAssets = accruedMarketState(
    state,
    borrowRatePerSecond,
    config.snapshot.blockTimestamp
  ).totalBorrowAssets;
  const estimatedAssets = toBorrowAssetsUp(
    position.borrowShares,
    totalAssets,
    state.totalBorrowShares
  );
  return {
    borrowShares: position.borrowShares,
    estimatedAssets,
    // The user reviews this finite allowance; the contract can collect only what is owed.
    suggestedApproval: min(
      ceilDiv(estimatedAssets * 101n, 100n),
      tokens.usdcBalance
    ),
    maxApproval: min(ceilDiv(estimatedAssets * 110n, 100n), tokens.usdcBalance),
  };
}

export function validateRepayAllReview(
  config: ActionContext,
  review: RepayAllReview
) {
  const quote = getRepayAllQuote(config);
  if (review.borrowShares <= 0n || review.borrowShares !== quote.borrowShares) {
    throw new Error("Borrow shares changed. Review repayment again.");
  }
  if (
    review.approvalAmount < quote.estimatedAssets ||
    review.approvalAmount > quote.maxApproval
  ) {
    throw new Error(
      "Approval limit must cover accrued debt and stay within your balance and 110% of estimated debt. Review a new limit."
    );
  }
}

function sequence(initial: ActionContext, runner: ActionRunner) {
  const account = owner(initial);
  return {
    async refresh() {
      const next = await runner.refresh();
      owner(next, account);
      if (
        next.morpho !== initial.morpho ||
        next.adapter !== initial.adapter ||
        next.marketId !== initial.marketId ||
        !sameMarketParams(marketParams(initial), marketParams(next))
      ) {
        throw new Error("Market changed. Review the action again.");
      }
      return next;
    },
    async submit(call: SimulatedWriteArgs) {
      runner.onStep?.(`Awaiting confirmation: ${call.summary}`);
      await runner.submit(call);
      runner.onStep?.(`Confirmed: ${call.summary}`);
    },
  };
}

export async function executeAction(
  initial: ActionContext,
  action: ActionKind,
  amount: ActionAmount,
  runner: ActionRunner,
  repayReview?: RepayAllReview
) {
  if (action === "repayUsdc" && amount === "all") {
    if (!repayReview)
      throw new Error(
        "Review a bounded approval limit before repaying all debt."
      );
    // Copy the review before awaiting so refreshes cannot change the approved bound.
    const review = { ...repayReview };
    validateRepayAllReview(initial, review);
    const flow = sequence(initial, runner);
    let current = await flow.refresh();
    validateRepayAllReview(current, review);
    if (
      current.snapshot.account.tokens.morphoUsdcAllowance !==
      review.approvalAmount
    ) {
      await flow.submit(buildApproval(current, "usdc", review.approvalAmount));
      current = await flow.refresh();
    }
    validateRepayAllReview(current, review);
    if (
      current.snapshot.account.tokens.morphoUsdcAllowance !==
      review.approvalAmount
    ) {
      throw new Error("Approval limit changed. Review repayment again.");
    }
    await flow.submit(buildRepay(current, owner(current), "all"));
    const result = await flow.refresh();
    if (result.snapshot.account.position.borrowShares !== 0n)
      throw new Error(
        "Borrow shares remain after repayment. Refresh and review your position."
      );
    return;
  }
  const flow = sequence(initial, runner);
  let current = await flow.refresh();
  validateAction(current, action, amount);
  const approval = requiredApproval(current, action, amount);
  if (approval && approval.allowance < approval.amount) {
    await flow.submit(buildApproval(current, approval.token, approval.amount));
    current = await flow.refresh();
  }
  validateAction(current, action, amount);
  const latestApproval = requiredApproval(current, action, amount);
  if (latestApproval && latestApproval.allowance < latestApproval.amount) {
    throw new Error(
      "Required approval changed. Review the updated amount and try again."
    );
  }
  await flow.submit(buildAction(current, action, amount));
  await flow.refresh();
}

export async function executeIncreaseUtilization(
  initial: ActionContext,
  collateral: bigint,
  borrow: bigint,
  runner: ActionRunner
) {
  const flow = sequence(initial, runner);
  let current = await flow.refresh();
  const validatePlan = () => {
    validateAction(current, "supplyCollateral", collateral);
    positive(borrow);
    if (borrow > getIncreaseBorrowMax(current, collateral))
      throw new Error(
        "Borrow amount exceeds projected safety margin or market liquidity."
      );
  };
  validatePlan();
  const approval = requiredApproval(current, "supplyCollateral", collateral);
  if (!approval) throw new Error("WETH approval is unavailable.");
  if (approval.allowance < collateral) {
    await flow.submit(buildApproval(current, "weth", collateral));
    current = await flow.refresh();
  }
  validatePlan();
  const latestApproval = requiredApproval(
    current,
    "supplyCollateral",
    collateral,
  );
  if (!latestApproval || latestApproval.allowance < collateral)
    throw new Error("WETH approval is insufficient.");
  await flow.submit(buildSupplyCollateral(current, owner(current), collateral));
  current = await flow.refresh();
  validateAction(current, "borrowUsdc", borrow);
  await flow.submit(buildBorrow(current, owner(current), borrow));
  await flow.refresh();
}
