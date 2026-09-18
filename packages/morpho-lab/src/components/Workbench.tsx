import { useRef, useState } from "react";
import { getAddress } from "viem";
import type { LabConfig } from "../config";
import {
  createActionContext,
  executeAction,
  executeIncreaseUtilization,
  type ActionContext,
  type ActionRunner,
} from "../protocol/actions";
import type { ProtocolSnapshot } from "../types";
import { useMetaMask } from "../wallet/MetaMaskProvider";
import { AmountAction } from "./AmountAction";
import { IncreaseUtilization } from "./IncreaseUtilization";
import { RepayAllAction } from "./RepayAllAction";

export function Workbench({
  config,
  snapshot,
  refresh,
  stale,
}: {
  config: LabConfig;
  snapshot: ProtocolSnapshot;
  refresh: () => Promise<ProtocolSnapshot>;
  stale: boolean;
}) {
  const wallet = useMetaMask();
  const walletRef = useRef(wallet);
  walletRef.current = wallet;
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const account = wallet.account;
  const matches =
    account !== undefined &&
    snapshot.account !== undefined &&
    getAddress(snapshot.account.address) === getAddress(account);
  let context: ReturnType<typeof createActionContext> | undefined;
  let contextError: string | undefined;
  if (snapshot.account !== undefined) {
    try {
      context = createActionContext(config, snapshot);
    } catch (reason) {
      contextError = reason instanceof Error ? reason.message : String(reason);
    }
  }
  const disabled =
    busy ||
    stale ||
    wallet.chainId !== 11155111 ||
    wallet.status !== "connected";

  async function run(
    work: (context: ActionContext, runner: ActionRunner) => Promise<void>,
  ) {
    const reviewedAccount = account;
    const reviewedContext = context;
    if (
      running.current ||
      disabled ||
      !matches ||
      !reviewedContext ||
      reviewedAccount === undefined
    )
      return;
    running.current = true;
    setBusy(true);
    setError(undefined);
    setMessages([]);
    const expectedAccount = getAddress(reviewedAccount);
    const assertWallet = () => {
      const current = walletRef.current;
      if (
        !current.account ||
        getAddress(current.account) !== expectedAccount ||
        current.status !== "connected"
      ) {
        throw new Error("MetaMask account changed. Review the action again.");
      }
      if (current.chainId !== 11155111)
        throw new Error("Switch MetaMask to chain ID 11155111.");
    };
    try {
      await work(reviewedContext, {
        refresh: async () => {
          assertWallet();
          const next = await refresh();
          assertWallet();
          return createActionContext(config, next);
        },
        submit: async (call) => {
          assertWallet();
          return walletRef.current.submitSimulatedWrite(call);
        },
        onStep: (message) => setMessages((current) => [...current, message]),
      });
      setMessages((current) => [...current, "Complete. Balances updated."]);
    } catch (reason) {
      setError(
        `${
          reason instanceof Error ? reason.message : String(reason)
        } Sequence stopped. Confirmed steps remain completed; review balances and activity before retrying.`
      );
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="workbench" aria-labelledby="workbench-title">
      <h2 id="workbench-title">Lending workbench</h2>
      {contextError ? (
        <p className="refresh-error" role="alert">
          {contextError}
        </p>
      ) : null}
      {!matches ? (
        <p className="empty-state">
          Connect MetaMask and refresh your account balances.
        </p>
      ) : context ? (
        <>
          {wallet.chainId !== 11155111 ? (
            <p className="refresh-error">
              Switch MetaMask to chain ID 11155111 to enable actions.
            </p>
          ) : null}
          {stale ? (
            <p className="refresh-error">Refresh balances before continuing.</p>
          ) : null}
          <div
            className="workbench-feedback"
            aria-live="polite"
            aria-busy={busy}
          >
            {messages.length ? (
              <ol>
                {messages.map((message, index) => (
                  <li key={index}>{message}</li>
                ))}
              </ol>
            ) : null}
            {error ? (
              <p className="action-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          {(
            [
              ["ETH / WETH", ["wrapEth", "unwrapWeth"]],
              ["Direct USDC lending", ["supplyUsdc", "withdrawUsdc"]],
              ["WETH collateral", ["supplyCollateral", "withdrawCollateral"]],
              ["USDC debt", ["borrowUsdc", "repayUsdc"]],
            ] as const
          ).map(([title, actions]) => (
            <section
              className="workbench-section"
              key={title}
              aria-label={title}
            >
              <h2>{title}</h2>
              <div className="action-grid">
                {actions.map((action) => (
                  <AmountAction
                    key={`${account}-${action}`}
                    context={context}
                    action={action}
                    disabled={disabled}
                    onRun={(kind, amount) =>
                      run((reviewedContext, runner) =>
                        executeAction(reviewedContext, kind, amount, runner)
                      )
                    }
                  />
                ))}
              </div>
            </section>
          ))}
          <section className="workbench-section" aria-label="Position unwind">
            <h2>Position unwind</h2>
            <div className="action-grid">
              <RepayAllAction
                key={`${account}-repay-all`}
                context={context}
                disabled={disabled}
                onRun={(review) =>
                  run((reviewedContext, runner) =>
                    executeAction(
                      reviewedContext,
                      "repayUsdc",
                      "all",
                      runner,
                      review,
                    )
                  )
                }
              />
              <AmountAction
                key={`${account}-withdraw-all`}
                context={context}
                action="withdrawUsdc"
                all
                disabled={disabled}
                onRun={(kind, amount) =>
                  run((reviewedContext, runner) =>
                    executeAction(reviewedContext, kind, amount, runner)
                  )
                }
              />
            </div>
          </section>
          <IncreaseUtilization
            key={account}
            context={context}
            disabled={disabled}
            onRun={(collateral, borrow) =>
              run((reviewedContext, runner) =>
                executeIncreaseUtilization(
                  reviewedContext,
                  collateral,
                  borrow,
                  runner,
                )
              )
            }
          />
        </>
      ) : null}
    </section>
  );
}
