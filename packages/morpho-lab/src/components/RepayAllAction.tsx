import { useId, useState } from "react";
import { formatUnits } from "viem";
import { ActionParties } from "./ActionParties";
import {
  getRepayAllQuote,
  parseAmount,
  validateRepayAllReview,
  type ActionContext,
  type RepayAllReview,
} from "../protocol/actions";

export function RepayAllAction({
  context,
  disabled,
  onRun,
}: {
  context: ActionContext;
  disabled: boolean;
  onRun: (review: RepayAllReview) => Promise<void>;
}) {
  const id = useId();
  const [limitInput, setLimitInput] = useState<string>();
  const [frozen, setFrozen] = useState<{
    quote: ReturnType<typeof getRepayAllQuote>;
    review: RepayAllReview;
  }>();
  const [confirmed, setConfirmed] = useState(false);
  if (context.snapshot.account.position.borrowShares === 0n)
    return (
      <section className="amount-action">
        <h3>Repay all debt</h3>
        <p role="status">No outstanding debt.</p>
      </section>
    );
  let quote: ReturnType<typeof getRepayAllQuote> | undefined;
  let review: RepayAllReview | undefined;
  let error: string | undefined;
  try {
    quote = frozen?.quote ?? getRepayAllQuote(context);
    review = frozen?.review ?? {
      borrowShares: quote.borrowShares,
      approvalAmount: parseAmount(
        limitInput ?? formatUnits(quote.suggestedApproval, 6),
        6,
      ),
    };
    validateRepayAllReview(context, review);
  } catch (reason) {
    error = reason instanceof Error ? reason.message : String(reason);
  }
  const allowance = context.snapshot.account.tokens.morphoUsdcAllowance;
  const limit = frozen
    ? formatUnits(frozen.review.approvalAmount, 6)
    : (limitInput ?? (quote ? formatUnits(quote.suggestedApproval, 6) : ""));

  return (
    <form
      className="amount-action"
      onSubmit={(event) => {
        event.preventDefault();
        if (!disabled && confirmed && review && !error) {
          setConfirmed(false);
          void onRun({ ...review });
        }
      }}
    >
      <h3>Repay all debt</h3>
      <p>
        Estimated debt with accrued interest:{" "}
        {quote ? formatUnits(quote.estimatedAssets, 6) : "Unavailable"} USDC
      </p>
      <label htmlFor={id}>Repayment approval limit (USDC)</label>
      <div className="amount-input">
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={limit}
          disabled={disabled || confirmed}
          onChange={(event) => {
            setLimitInput(event.target.value);
            setFrozen(undefined);
            setConfirmed(false);
          }}
        />
      </div>
      <p className="action-hint">
        Available: {formatUnits(context.snapshot.account.tokens.usdcBalance, 6)}{" "}
        USDC. Maximum approval:{" "}
        {quote ? formatUnits(quote.maxApproval, 6) : "Unavailable"} USDC.
      </p>
      <p className="action-hint">
        The suggested limit includes 1% for interest. Only the debt owed is
        collected; any unused allowance remains.
      </p>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setFrozen(undefined);
          setLimitInput(undefined);
          setConfirmed(false);
        }}
      >
        Update repayment estimate
      </button>
      <div className="action-review">
        <p>
          <strong>Confirmation</strong>: repay all{" "}
          {quote?.borrowShares.toString() ?? "-"} borrow shares
        </p>
        <ActionParties
          account={context.snapshot.account.address}
          destination={context.morpho}
        />
        <p>Current allowance: {formatUnits(allowance, 6)} USDC</p>
        <p>Reviewed approval limit: {limit || "-"} USDC</p>
        <ol aria-label="Repay all debt transaction sequence">
          {review && allowance !== review.approvalAmount ? (
            <li>
              Set allowance to exactly {formatUnits(review.approvalAmount, 6)}{" "}
              USDC for Morpho
            </li>
          ) : null}
          <li>Repay all USDC borrow shares</li>
        </ol>
      </div>
      <label className="review-checkbox">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={disabled || !!error}
          onChange={(event) => {
            if (event.target.checked && quote && review)
              setFrozen({ quote, review: { ...review } });
            setConfirmed(event.target.checked);
          }}
        />
        I confirm the displayed USDC approval limit and full repayment.
      </label>
      <p className="action-error" role={error ? "alert" : undefined}>
        {error ?? "\u00a0"}
      </p>
      <button
        className="action-submit"
        type="submit"
        disabled={disabled || !confirmed || !!error}
      >
        Confirm repay all debt
      </button>
    </form>
  );
}
