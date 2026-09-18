import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AccountPanel } from "./components/AccountPanel";
import { AdapterPanel } from "./components/AdapterPanel";
import { DeploymentPanel } from "./components/DeploymentPanel";
import { MarketPanel } from "./components/MarketPanel";
import { OperatorPanel } from "./components/OperatorPanel";
import { PoolPanel } from "./components/PoolPanel";
import { TransactionLog } from "./components/TransactionLog";
import { WalletBar } from "./components/WalletBar";
import { Workbench } from "./components/Workbench";
import { blockscoutBlockUrl, formatTimestamp } from "./format";
import { readProtocolSnapshot } from "./protocol/read";
import { watchProtocolBlocks } from "./protocol/watch";
import type { ProtocolSnapshot } from "./types";
import { MetaMaskProvider, useMetaMask } from "./wallet/MetaMaskProvider";
import { loadLabConfig, type LabConfig } from "./config";

export function App({
  env = import.meta.env,
}: {
  env?: Record<string, string | undefined>;
}) {
  let config: LabConfig;
  try {
    config = loadLabConfig(env);
  } catch (reason) {
    return (
      <main className="lab-shell">
        <h1>Configuration error</h1>
        <p role="alert">
          {reason instanceof Error ? reason.message : String(reason)}
        </p>
        <p>
          Check the VITE_ overrides in packages/morpho-lab/.env.local, then
          restart the lab.
        </p>
      </main>
    );
  }
  return (
    <MetaMaskProvider config={config}>
      <AppContent config={config} />
    </MetaMaskProvider>
  );
}

function AppContent({ config }: { config: LabConfig }) {
  const { account, chainId, publicClient, transactions } = useMetaMask();
  const [snapshot, setSnapshot] = useState<ProtocolSnapshot>();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string>();
  const accountRef = useRef(account);
  const refreshQueue = useRef<Promise<unknown>>(Promise.resolve());
  const pendingRefreshes = useRef(0);
  accountRef.current = account;

  const refresh = useCallback((): Promise<ProtocolSnapshot> => {
    pendingRefreshes.current += 1;
    setRefreshing(true);
    const next = refreshQueue.current
      .catch(() => undefined)
      .then(async () => {
        const requestedAccount = accountRef.current;
        try {
          const nextSnapshot = await readProtocolSnapshot(
            publicClient,
            config,
            requestedAccount
          );
          if (accountRef.current !== requestedAccount)
            throw new Error("Account changed during refresh.");
          setSnapshot(nextSnapshot);
          setRefreshError(undefined);
          return nextSnapshot;
        } catch (reason) {
          setRefreshError(
            reason instanceof Error ? reason.message : String(reason)
          );
          throw reason;
        } finally {
          pendingRefreshes.current -= 1;
          setRefreshing(pendingRefreshes.current > 0);
        }
      });
    refreshQueue.current = next;
    return next;
  }, [publicClient, config]);

  const confirmedTransactions = useMemo(
    () =>
      transactions
        .filter((transaction) => transaction.status === "confirmed")
        .map((transaction) => transaction.id)
        .join(","),
    [transactions]
  );

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, [account, chainId, confirmedTransactions, refresh]);

  useEffect(
    () =>
      watchProtocolBlocks(publicClient, () => {
        void refresh().catch(() => undefined);
      }),
    [publicClient, refresh]
  );

  const stateLabel =
    refreshError === undefined
      ? refreshing
        ? "Refreshing"
        : snapshot === undefined
        ? "Loading"
        : "Current"
      : snapshot === undefined
      ? "Read failed"
      : "Stale";

  return (
    <main className="lab-shell">
      <header className="lab-header">
        <div>
          <p className="eyebrow">Local technical playground</p>
          <h1>SorteCerta Morpho Lab</h1>
        </div>
        <div
          className={`status ${
            refreshError === undefined ? "" : "status--warning"
          }`}
          role="status"
        >
          <span>{stateLabel}</span>
          <button
            disabled={refreshing}
            onClick={() => void refresh().catch(() => undefined)}
            type="button"
          >
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </header>

      {refreshError === undefined ? null : (
        <p className="refresh-error" role="alert">
          {refreshError}
        </p>
      )}
      {snapshot === undefined ? (
        <section className="loading-panel">
          <p>Reading configured protocol state...</p>
        </section>
      ) : (
        <>
          <section className="dashboard-meta" aria-label="Snapshot details">
            <span>Chain ID {config.chainId}</span>
            <a
              href={blockscoutBlockUrl(snapshot.blockNumber)}
              rel="noreferrer"
              target="_blank"
            >
              Block {snapshot.blockNumber.toString()}
            </a>
            <span>
              Read {formatTimestamp(Math.floor(snapshot.refreshedAt / 1_000))}
            </span>
          </section>
          <section className="dashboard-grid" aria-label="Protocol dashboard">
            <DeploymentPanel deployment={snapshot.deployment} />
            <PoolPanel pool={snapshot.pool} />
            <OperatorPanel
              config={config}
              refresh={refresh}
              snapshot={snapshot}
              stale={refreshError !== undefined}
            />
            <AdapterPanel adapter={snapshot.adapter} />
            <MarketPanel market={snapshot.market} />
            <AccountPanel account={snapshot.account} />
          </section>
        </>
      )}
      <section className="support-grid" aria-label="Wallet and activity">
        <article className="panel">
          <WalletBar
            ethBalance={
              snapshot?.account?.address === account
                ? snapshot?.account?.tokens.ethBalance
                : undefined
            }
          />
        </article>
        <article className="panel">
          <TransactionLog />
        </article>
      </section>
      {snapshot ? (
        <Workbench
          config={config}
          snapshot={snapshot}
          refresh={refresh}
          stale={refreshError !== undefined}
        />
      ) : null}
    </main>
  );
}
