import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AccountPanel } from "./components/AccountPanel";
import { AdapterPanel } from "./components/AdapterPanel";
import { DeploymentPanel } from "./components/DeploymentPanel";
import { MarketPanel } from "./components/MarketPanel";
import { PoolPanel } from "./components/PoolPanel";
import { TransactionLog } from "./components/TransactionLog";
import { WalletBar } from "./components/WalletBar";
import { blockscoutBlockUrl, formatTimestamp } from "./format";
import { readProtocolSnapshot } from "./protocol/read";
import type { ProtocolSnapshot } from "./types";
import { MetaMaskProvider, useMetaMask } from "./wallet/MetaMaskProvider";
import { loadLabConfig } from "./config";

const config = loadLabConfig(import.meta.env);

export function App() {
  return (
    <MetaMaskProvider config={config}>
      <AppContent />
    </MetaMaskProvider>
  );
}

function AppContent() {
  const { account, chainId, publicClient, transactions } = useMetaMask();
  const [snapshot, setSnapshot] = useState<ProtocolSnapshot>();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string>();
  const accountRef = useRef(account);
  const inFlight = useRef(false);
  const queued = useRef(false);
  accountRef.current = account;

  const refresh = useCallback(async () => {
    if (inFlight.current) {
      queued.current = true;
      return;
    }

    inFlight.current = true;
    setRefreshing(true);
    try {
      const nextSnapshot = await readProtocolSnapshot(
        publicClient,
        config,
        accountRef.current
      );
      setSnapshot(nextSnapshot);
      setRefreshError(undefined);
    } catch (reason) {
      setRefreshError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      inFlight.current = false;
      setRefreshing(false);
      if (queued.current) {
        queued.current = false;
        void refresh();
      }
    }
  }, [publicClient]);

  const confirmedTransactions = useMemo(
    () => transactions.filter((transaction) => transaction.status === "confirmed").map((transaction) => transaction.id).join(","),
    [transactions]
  );

  useEffect(() => {
    void refresh();
  }, [account, chainId, confirmedTransactions, refresh]);

  const stateLabel = refreshError === undefined
    ? refreshing ? "Refreshing" : snapshot === undefined ? "Loading" : "Current"
    : snapshot === undefined ? "Read failed" : "Stale";

  return (
    <main className="lab-shell">
      <header className="lab-header">
        <div>
          <p className="eyebrow">Local technical playground</p>
          <h1>SorteCerta Morpho Lab</h1>
        </div>
        <div className={`status ${refreshError === undefined ? "" : "status--warning"}`} role="status">
          <span>{stateLabel}</span>
          <button disabled={refreshing} onClick={() => void refresh()} type="button">
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </header>

      {refreshError === undefined ? null : <p className="refresh-error" role="alert">{refreshError}</p>}
      {snapshot === undefined ? <section className="loading-panel"><p>Reading configured protocol state...</p></section> : <>
        <section className="dashboard-meta" aria-label="Snapshot details">
          <span>Chain ID {config.chainId}</span>
          <a href={blockscoutBlockUrl(snapshot.blockNumber)} rel="noreferrer" target="_blank">Block {snapshot.blockNumber.toString()}</a>
          <span>Read {formatTimestamp(Math.floor(snapshot.refreshedAt / 1_000))}</span>
        </section>
        <section className="dashboard-grid" aria-label="Protocol dashboard">
          <DeploymentPanel deployment={snapshot.deployment} />
          <PoolPanel pool={snapshot.pool} />
          <AdapterPanel adapter={snapshot.adapter} />
          <MarketPanel market={snapshot.market} />
          <AccountPanel account={snapshot.account} />
        </section>
      </>}
      <section className="support-grid" aria-label="Wallet and activity">
        <article className="panel">
          <WalletBar />
        </article>
        <article className="panel">
          <TransactionLog />
        </article>
      </section>
    </main>
  );
}
