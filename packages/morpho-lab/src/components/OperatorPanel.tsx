import { useEffect, useState } from "react";

import type { LabConfig } from "../config";
import { formatTimestamp, formatToken } from "../format";
import { buildCloseDraw } from "../protocol/operator-actions";
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
  const { account, chainId, status, submitSimulatedWrite } = useMetaMask();
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1_000));
  const [progress, setProgress] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const drawIsReady = snapshot.pool.nextDrawAt <= BigInt(now);
  const disabled =
    busy ||
    stale ||
    !drawIsReady ||
    account === undefined ||
    status !== "connected" ||
    chainId !== 11155111;

  useEffect(() => {
    const interval = window.setInterval(
      () => setNow(Math.floor(Date.now() / 1_000)),
      1_000
    );
    return () => window.clearInterval(interval);
  }, []);

  async function closeDraw() {
    if (disabled) return;

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
      <button disabled={disabled} onClick={() => void closeDraw()} type="button">
        {busy ? "Closing draw" : "Close draw"}
      </button>
      <div aria-busy={busy} aria-live="polite" className="operator-feedback">
        {progress ? <p>{progress}</p> : null}
        {error ? (
          <p className="action-error" role="alert">
            {error}
          </p>
        ) : null}
        {!drawIsReady ? <p>Draw closes at the scheduled time.</p> : null}
      </div>
    </Panel>
  );
}
