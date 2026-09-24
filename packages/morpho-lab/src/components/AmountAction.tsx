import { useId, useState } from "react";
import { formatUnits } from "viem";
import { ActionParties } from "./ActionParties";
import {
  actionAssets,
  actionLabel,
  buildAction,
  getActionMax,
  parseAmount,
  requiredApproval,
  type ActionAmount,
  type ActionContext,
  type ActionKind,
} from "../protocol/actions";

export type AmountActionProps = {
  context: ActionContext;
  action: ActionKind;
  disabled: boolean;
  all?: boolean;
  onRun: (action: ActionKind, amount: ActionAmount) => Promise<void>;
};

export function AmountAction({
  context,
  action,
  disabled,
  all = false,
  onRun,
}: AmountActionProps) {
  const id = useId();
  const [input, setInput] = useState("");
  const usdc = action.endsWith("Usdc");
  const decimals = usdc ? 6 : 18;
  const symbol = usdc ? "USDC" : action === "wrapEth" ? "ETH" : "WETH";
  const title = all
    ? action === "repayUsdc"
      ? "Repay all debt"
      : "Withdraw all direct supply"
    : actionLabel(action);
  let error: string | undefined;
  let max = 0n;
  let amount: ActionAmount = 0n;
  let assets = 0n;
  let call: ReturnType<typeof buildAction> | undefined;
  let approval: ReturnType<typeof requiredApproval>;
  try {
    max = getActionMax(context, action);
    amount = all ? "all" : parseAmount(input, decimals);
    assets = actionAssets(context, action, amount);
    call = buildAction(context, action, amount);
    approval = requiredApproval(context, action, amount);
  } catch (reason) {
    error = reason instanceof Error ? reason.message : String(reason);
  }
  const needsApproval =
    approval !== undefined && approval.allowance < approval.amount;

  return (
    <form
      className="amount-action"
      onSubmit={(event) => {
        event.preventDefault();
        if (!disabled && call) void onRun(action, amount);
      }}
    >
      <h3>{title}</h3>
      <label htmlFor={id}>
        {all ? "Estimated amount" : "Amount"} ({symbol})
      </label>
      <div className="amount-input">
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={all ? formatUnits(assets, decimals) : input}
          readOnly={all}
          disabled={disabled}
          aria-invalid={input !== "" && error !== undefined}
          aria-describedby={`${id}-max ${id}-error`}
          onChange={(event) => {
            setInput(event.target.value);
          }}
        />
        {all ? null : (
          <button
            type="button"
            disabled={disabled || max === 0n}
            onClick={() => {
              setInput(formatUnits(max, decimals));
            }}
          >
            Max
          </button>
        )}
      </div>
      <p className="action-hint" id={`${id}-max`}>
        Available / max: {formatUnits(max, decimals)} {symbol}
      </p>
      {action === "wrapEth" ? (
        <p className="action-hint">0.001 ETH reserved for fees.</p>
      ) : null}
      {action === "borrowUsdc" ? (
        <p className="action-hint">
          Borrow ceiling: {Number(context.safetyBps) / 100}% of LLTV.
        </p>
      ) : null}
      <div className="action-review">
        <p>
          <strong>Confirmation</strong>
        </p>
        <p>
          {call
            ? `${title}: ${all ? "approximately " : ""}${formatUnits(
                assets,
                decimals,
              )} ${symbol}`
            : "Amount required"}
        </p>
        {all ? (
          <p>
            All {action === "repayUsdc" ? "borrow" : "supply"} shares:{" "}
            {(action === "repayUsdc"
              ? context.snapshot.account.position.borrowShares
              : context.snapshot.account.position.supplyShares
            ).toString()}
          </p>
        ) : null}
        <ActionParties
          account={context.snapshot.account.address}
          destination={
            usdc || action.includes("Collateral")
              ? context.morpho
              : context.weth
          }
        />
        <p>
          Approval:{" "}
          {approval
            ? `${formatUnits(
                approval.allowance,
                decimals,
              )} ${symbol} allowed for Morpho${
                needsApproval ? "; approval required" : "; sufficient"
              }`
            : "Not required"}
        </p>
        <ol aria-label={`${title} transaction sequence`}>
          {needsApproval && approval ? (
            <li>
              Approve exactly {formatUnits(approval.amount, decimals)} {symbol}{" "}
              for Morpho
            </li>
          ) : null}
          <li>{call?.summary ?? title}</li>
        </ol>
      </div>
      <p
        className="action-error"
        id={`${id}-error`}
        role={error && (input || all) ? "alert" : undefined}
      >
        {(input || all) && error ? error : "\u00a0"}
      </p>
      <button
        className="action-submit"
        type="submit"
        disabled={disabled || !call}
      >
        Confirm {title.toLowerCase()}
      </button>
    </form>
  );
}
