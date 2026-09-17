import { useId, useState } from "react";
import { formatUnits } from "viem";
import {
  getIncreaseBorrowMax,
  parseAmount,
  validateAction,
  type ActionContext,
} from "../protocol/actions";

export function IncreaseUtilization({
  context,
  disabled,
  onRun,
}: {
  context: ActionContext;
  disabled: boolean;
  onRun(collateral: bigint, borrow: bigint): Promise<void>;
}) {
  const id = useId();
  const [collateralInput, setCollateralInput] = useState("");
  const [borrowInput, setBorrowInput] = useState<string>();
  const [reviewed, setReviewed] = useState(false);
  let collateral = 0n;
  let borrow = 0n;
  let maxBorrow = 0n;
  let error: string | undefined;
  try {
    collateral = parseAmount(collateralInput, 18);
    validateAction(context, "supplyCollateral", collateral);
    maxBorrow = getIncreaseBorrowMax(context, collateral);
    borrow = parseAmount(borrowInput ?? formatUnits(maxBorrow, 6), 6);
    if (borrow > maxBorrow)
      throw new Error(
        "Borrow amount exceeds the safety margin or market liquidity."
      );
  } catch (reason) {
    error = reason instanceof Error ? reason.message : String(reason);
  }
  const allowance = context.snapshot.account!.tokens.morphoWethAllowance;
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
          <div>
            <label htmlFor={`${id}-collateral`}>WETH collateral amount</label>
            <div className="amount-input">
              <input
                id={`${id}-collateral`}
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                disabled={disabled}
                value={collateralInput}
                onChange={(event) => {
                  setCollateralInput(event.target.value);
                  setBorrowInput(undefined);
                  setReviewed(false);
                }}
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  setCollateralInput(
                    formatUnits(
                      context.snapshot.account!.tokens.wethBalance,
                      18
                    )
                  );
                  setBorrowInput(undefined);
                  setReviewed(false);
                }}
              >
                Max
              </button>
            </div>
            <p className="action-hint">
              Available:{" "}
              {formatUnits(context.snapshot.account!.tokens.wethBalance, 18)}{" "}
              WETH
            </p>
          </div>
          <div>
            <label htmlFor={`${id}-borrow`}>USDC borrow amount</label>
            <div className="amount-input">
              <input
                id={`${id}-borrow`}
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                disabled={disabled}
                value={
                  borrowInput ??
                  (collateral > 0n ? formatUnits(maxBorrow, 6) : "")
                }
                onChange={(event) => {
                  setBorrowInput(event.target.value);
                  setReviewed(false);
                }}
              />
              <button
                type="button"
                disabled={disabled || maxBorrow === 0n}
                onClick={() => {
                  setBorrowInput(formatUnits(maxBorrow, 6));
                  setReviewed(false);
                }}
              >
                Max
              </button>
            </div>
            <p className="action-hint">
              Max: {formatUnits(maxBorrow, 6)} USDC at{" "}
              {Number(context.safetyBps) / 100}% of LLTV
            </p>
          </div>
        </div>
        <div className="action-review">
          <p>
            <strong>Confirmation</strong>: supply {formatUnits(collateral, 18)}{" "}
            WETH and borrow {formatUnits(borrow, 6)} USDC
          </p>
          <p>
            Account:{" "}
            <span className="action-address">
              {context.snapshot.account!.address}
            </span>
          </p>
          <p>
            Destination:{" "}
            <span className="action-address">{context.morpho}</span>
          </p>
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
            onChange={(event) => setReviewed(event.target.checked)}
          />
          I confirm this additional collateral deposit and borrowing amount.
        </label>
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
