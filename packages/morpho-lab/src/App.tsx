import { loadLabConfig } from "./config";
import { TransactionLog } from "./components/TransactionLog";
import { WalletBar } from "./components/WalletBar";
import { MetaMaskProvider } from "./wallet/MetaMaskProvider";

const config = loadLabConfig(import.meta.env);

const deploymentRows = [
  ["Chain", String(config.chainId)],
  ["RPC", config.rpcUrl],
  ["Pool", config.pool],
  ["Adapter", config.adapter],
  ["Morpho", config.morpho],
  ["Market", config.marketId],
];

const panels = [
  {
    title: "Metrics",
    body: "Pool, adapter, market, and account reads will appear here.",
  },
  {
    title: "Workbench",
    body: "Simulation-backed Morpho actions will appear here.",
  },
];

export function App() {
  return (
    <MetaMaskProvider config={config}>
      <AppContent />
    </MetaMaskProvider>
  );
}

function AppContent() {
  return (
    <main className="lab-shell">
      <header className="lab-header">
        <div>
          <p className="eyebrow">Local technical playground</p>
          <h1>SorteCerta Morpho Lab</h1>
        </div>
        <div className="status" role="status">
          Configuration valid
        </div>
      </header>

      <section className="deployment" aria-labelledby="deployment-title">
        <h2 id="deployment-title">Configured Deployment</h2>
        <dl className="deployment-grid">
          {deploymentRows.map(([label, value]) => (
            <div className="deployment-row" key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="panel-grid" aria-label="Lab work areas">
        <article className="panel">
          <WalletBar />
        </article>
        {panels.map((panel) => (
          <article className="panel" key={panel.title}>
            <h2>{panel.title}</h2>
            <p>{panel.body}</p>
          </article>
        ))}
        <article className="panel">
          <TransactionLog />
        </article>
      </section>
    </main>
  );
}
