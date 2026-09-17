import { useEffect, useRef, useState } from "react";
import { getAddress } from "viem";

import type { LabConfig } from "../config";
import { formatTimestamp, formatToken } from "../format";
import { buildCloseDraw } from "../protocol/operator-actions";
import { getCloseDrawState } from "../protocol/operator-state";
import { parseAmount } from "../protocol/actions";
import {
  executePrizeFunding,
  prizeFundingAbi,
} from "../protocol/prize-funding";
import { encryptPrizeAmount } from "../protocol/zama";
import type { ProtocolSnapshot } from "../types";
import { useMetaMask } from "../wallet/MetaMaskProvider";
import { Panel } from "./DeploymentPanel";

export function OperatorPanel({
  config,
  snapshot,
  refresh,
  stale,
}: {
  config: LabConfig;
  snapshot: ProtocolSnapshot;
  refresh(): Promise<ProtocolSnapshot>;
  stale: boolean;
}) {
  const wallet = useMetaMask();
  const walletRef = useRef(wallet);
  walletRef.current = wallet;
  const running = useRef(false);
  const { account, chainId, status, submitSimulatedWrite } = wallet;
  const [fundAmount, setFundAmount] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1_000));
  const [progress, setProgress] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const closeDrawState = getCloseDrawState({
    account,
    busy,
    chainId,
    nextDrawAt: snapshot.pool.nextDrawAt,
    now,
    stale,
    status,
  });
  const fundingDisabled =
    busy ||
    stale ||
    !account ||
    status !== "connected" ||
    chainId !== 11155111 ||
    snapshot.account?.address !== account;
  let amount: bigint | undefined;
  try {
    amount = parseAmount(fundAmount, 6);
  } catch {
    /* Input may be incomplete. */
  }
  const validFunding =
    amount !== undefined &&
    amount < 2n ** 64n &&
    amount <= (snapshot.account?.tokens.usdcBalance ?? 0n);

  useEffect(() => {
    setReviewed(false);
  }, [account, chainId]);

  async function fundPrize() {
    if (
      fundingDisabled ||
      !validFunding ||
      !reviewed ||
      amount === undefined ||
      running.current
    )
      return;
    running.current = true;
    setBusy(true);
    setError(undefined);
    const expectedAccount = getAddress(account!);
    const assertWallet = () => {
      const current = walletRef.current;
      if (
        !current.account ||
        getAddress(current.account) !== expectedAccount ||
        current.chainId !== 11155111 ||
        current.status !== "connected"
      )
        throw new Error(
          "MetaMask account or chain changed. Review funding again."
        );
    };
    try {
      await executePrizeFunding(config, expectedAccount, amount, {
        refresh: async () => {
          assertWallet();
          const next = await refresh();
          assertWallet();
          return next;
        },
        submit: async (call) => {
          assertWallet();
          return walletRef.current.submitSimulatedWrite(call);
        },
        readFundingSelector: (pool) =>
          wallet.publicClient.readContract({
            address: pool,
            abi: prizeFundingAbi,
            functionName: "PRIZE_FUNDING_DATA",
          }),
        encrypt: (wrapper, user, value) =>
          encryptPrizeAmount(config.rpcUrl, wrapper, user, value),
        onStep: setProgress,
      });
      setProgress("Prize funding confirmed.");
      setFundAmount("");
    } catch (reason) {
      setError(
        `${
          reason instanceof Error ? reason.message : String(reason)
        } Sequence stopped; review activity before retrying.`
      );
      setProgress(undefined);
    } finally {
      setReviewed(false);
      setBusy(false);
      running.current = false;
    }
  }

  useEffect(() => {
    const interval = window.setInterval(
      () => setNow(Math.floor(Date.now() / 1_000)),
      1_000
    );
    return () => window.clearInterval(interval);
  }, []);

  async function closeDraw() {
    if (closeDrawState.disabled || running.current) return;

    running.current = true;
    setBusy(true);
    setError(undefined);
    setProgress("Simulating close draw...");
    try {
      await submitSimulatedWrite(buildCloseDraw(config, snapshot));
      setProgress("Close draw confirmed. Refreshing protocol state...");
      await refresh();
      setProgress("Close draw complete.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setProgress(undefined);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  return (
    <Panel title="Round controls">
      <dl className="operator-metrics">
        <div>
          <dt>Current draw</dt>
          <dd>{snapshot.pool.drawId.toString()}</dd>
        </div>
        <div>
          <dt>Active prize</dt>
          <dd>{formatToken(snapshot.pool.publicPrizeReserve)} USDC</dd>
        </div>
        <div>
          <dt>Next draw</dt>
          <dd>{formatTimestamp(snapshot.pool.nextDrawAt)}</dd>
        </div>
      </dl>
      <button
        disabled={closeDrawState.disabled}
        onClick={() => void closeDraw()}
        type="button"
      >
        Close draw
      </button>
      <div className="funding-controls">
        <h3>Sponsor prize</h3>
        <label htmlFor="prize-amount">Amount (USDC)</label>
        <input
          id="prize-amount"
          inputMode="decimal"
          value={fundAmount}
          disabled={busy}
          onChange={(event) => {
            setFundAmount(event.target.value);
            setReviewed(false);
          }}
        />
        <p>
          Available: {formatToken(snapshot.account?.tokens.usdcBalance, 6, 6)}{" "}
          USDC
        </p>
        <p>Prize pool: {config.pool}</p>
        <p>Approval spender: {config.wrapper}</p>
        <ol>
          <li>
            Approve {formatToken(amount, 6, 6)} USDC for the wrapper if needed.
          </li>
          <li>Wrap and fund the prize in one transaction.</li>
        </ol>
        <label>
          <input
            type="checkbox"
            checked={reviewed}
            disabled={Boolean(fundingDisabled) || !validFunding}
            onChange={(event) => setReviewed(event.target.checked)}
          />{" "}
          Fund the prize with {formatToken(amount, 6, 6)} USDC
        </label>
        <button
          type="button"
          disabled={Boolean(fundingDisabled) || !validFunding || !reviewed}
          onClick={() => void fundPrize()}
        >
          Confirm prize funding
        </button>
      </div>
      <div aria-busy={busy} aria-live="polite" className="operator-feedback">
        {progress ? <p>{progress}</p> : null}
        {error ? (
          <p className="action-error" role="alert">
            {error}
          </p>
        ) : null}
        {closeDrawState.reason ? <p>{closeDrawState.reason}</p> : null}
      </div>
    </Panel>
  );
}
