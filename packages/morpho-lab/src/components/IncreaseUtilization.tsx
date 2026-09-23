import { useId, useState, type ReactNode } from "react";
import { formatUnits } from "viem";
import { ActionParties } from "./ActionParties";
import {
  getIncreaseBorrowMax,
  parseAmount,
  validateAction,
  type ActionContext,
} from "../protocol/actions";

function GuidedAmountField({
  disabled,
  hint,
  id,
  label,
  maxDisabled,
  onChange,
  onMax,
  value,
}: {
  disabled: boolean;
  hint: ReactNode;
  id: string;
  label: string;
  maxDisabled?: boolean;
  onChange: (value: string) => void;
  onMax: () => void;
  value: string;
}) {
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <div className="amount-input">
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          disabled={disabled}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
        <button
          type="button"
          disabled={disabled || maxDisabled}
          onClick={onMax}
        >
          Max
        </button>
      </div>
      <p className="action-hint">{hint}</p>
    </div>
  );
}

export function IncreaseUtilization({
  context,
  disabled,
  onRun,
}: {
  context: ActionContext;
  disabled: boolean;
  onRun: (collateral: bigint, borrow: bigint) => Promise<void>;
}) {
  const id = useId();
  const [collateralInput, setCollateralInput] = useState("");
  const [borrowInput, setBorrowInput] = useState<string>();
  const [reviewed, setReviewed] = useState(false);
  const [plan, setPlan] = useState<{
    collateral: bigint;
    borrow: bigint;
    maxBorrow: bigint;
    allowance: bigint;
  }>();
  let collateral = plan?.collateral ?? 0n;
  let borrow = plan?.borrow ?? 0n;
  let maxBorrow = plan?.maxBorrow ?? 0n;
  let error: string | undefined;
  try {
    if (!plan) {
      collateral = parseAmount(collateralInput, 18);
      validateAction(context, "supplyCollateral", collateral);
      maxBorrow = getIncreaseBorrowMax(context, collateral);
      borrow = parseAmount(borrowInput ?? formatUnits(maxBorrow, 6), 6);
      if (borrow <= 0n) throw new Error("Enter a positive amount.");
      if (borrow > maxBorrow)
        throw new Error(
          "Borrow amount exceeds the safety margin or market liquidity.",
        );
    }
  } catch (reason) {
    error = reason instanceof Error ? reason.message : String(reason);
  }
  const allowance =
    plan?.allowance ?? context.snapshot.account.tokens.morphoWethAllowance;
  const needsApproval = collateral > allowance;

  return (
    <section className="workbench-section" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>Increase utilization</h2>
      <form
        className="utilization-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!disabled && !error && reviewed) {
            setReviewed(false);
            void onRun(collateral, borrow);
          }
        }}
      >
        <div className="guided-inputs">
          <GuidedAmountField
            id={`${id}-collateral`}
            label="WETH collateral amount"
            disabled={disabled || reviewed}
            value={plan ? formatUnits(plan.collateral, 18) : collateralInput}
            onChange={(value) => {
              setPlan(undefined);
              setCollateralInput(value);
              setBorrowInput(undefined);
              setReviewed(false);
            }}
            onMax={() => {
              setPlan(undefined);
              setCollateralInput(
                formatUnits(context.snapshot.account.tokens.wethBalance, 18),
              );
              setBorrowInput(undefined);
              setReviewed(false);
            }}
            hint={
              <>
                Available:{" "}
                {formatUnits(context.snapshot.account.tokens.wethBalance, 18)}{" "}
                WETH
              </>
            }
          />
          <GuidedAmountField
            id={`${id}-borrow`}
            label="USDC borrow amount"
            disabled={disabled || reviewed}
            maxDisabled={maxBorrow === 0n}
            value={
              plan
                ? formatUnits(plan.borrow, 6)
                : (borrowInput ??
                  (collateral > 0n ? formatUnits(maxBorrow, 6) : ""))
            }
            onChange={(value) => {
              setPlan(undefined);
              setBorrowInput(value);
              setReviewed(false);
            }}
            onMax={() => {
              setPlan(undefined);
              setBorrowInput(formatUnits(maxBorrow, 6));
              setReviewed(false);
            }}
            hint={
              <>
                {plan ? "Max at review" : "Max"}: {formatUnits(maxBorrow, 6)}{" "}
                USDC at {Number(context.safetyBps) / 100}% of LLTV
              </>
            }
          />
        </div>
        <div className="action-review">
          <p>
            <strong>Confirmation</strong>: supply {formatUnits(collateral, 18)}{" "}
            WETH and borrow {formatUnits(borrow, 6)} USDC
          </p>
          <ActionParties
            account={context.snapshot.account.address}
            destination={context.morpho}
          />
          <p>
            Approval: {formatUnits(allowance, 18)} WETH allowed for Morpho;{" "}
            {needsApproval ? "approval required" : "sufficient"}
          </p>
          <ol aria-label="Increase utilization transaction sequence">
            {needsApproval ? (
              <li>
                Approve exactly {formatUnits(collateral, 18)} WETH for Morpho
              </li>
            ) : null}
            <li>Supply {formatUnits(collateral, 18)} WETH collateral</li>
            <li>Borrow {formatUnits(borrow, 6)} USDC</li>
          </ol>
          <p>
            Borrowing accrues interest. Price changes can put collateral at
            risk.
          </p>
        </div>
        <label className="review-checkbox">
          <input
            type="checkbox"
            checked={reviewed}
            disabled={disabled}
            onChange={(event) => {
              if (event.target.checked && !error)
                setPlan({ collateral, borrow, maxBorrow, allowance });
              setReviewed(event.target.checked);
            }}
          />
          I confirm this additional collateral deposit and borrowing amount.
        </label>
        {plan ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setPlan(undefined);
              setBorrowInput(undefined);
              setReviewed(false);
            }}
          >
            New utilization review
          </button>
        ) : null}
        <p
          className="action-error"
          role={error && collateralInput ? "alert" : undefined}
        >
          {collateralInput && error ? error : "\u00a0"}
        </p>
        <button
          className="action-submit"
          disabled={disabled || !!error || !reviewed}
          type="submit"
        >
          Confirm increase utilization
        </button>
      </form>
    </section>
  );
}
