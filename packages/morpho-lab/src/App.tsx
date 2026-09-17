import { loadLabConfig } from "./config";

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
    title: "Wallet",
    body: "MetaMask connection controls will appear here.",
  },
  {
    title: "Metrics",
    body: "Pool, adapter, market, and account reads will appear here.",
  },
  {
    title: "Workbench",
    body: "Simulation-backed Morpho actions will appear here.",
  },
  {
    title: "Activity",
    body: "Pending, confirmed, and failed transactions will appear here.",
  },
];

export function App() {
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
        {panels.map((panel) => (
          <article className="panel" key={panel.title}>
            <h2>{panel.title}</h2>
            <p>{panel.body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
