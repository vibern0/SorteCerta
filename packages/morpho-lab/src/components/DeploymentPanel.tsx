import { blockscoutAddressUrl, formatAddress } from "../format";
import type { DeploymentSnapshot } from "../types";
import { Metric } from "./Metric";

export function DeploymentPanel({ deployment }: { deployment: DeploymentSnapshot }) {
  const addresses = [
    ["USDC", deployment.usdc], ["WETH", deployment.weth], ["Wrapper", deployment.wrapper],
    ["Prize pool", deployment.pool], ["Yield adapter", deployment.adapter], ["Morpho", deployment.morpho],
  ] as const;
  return <Panel title="Deployment"><dl className="metric-grid">
    {addresses.map(([label, address]) => <Metric copyValue={address} href={blockscoutAddressUrl(address)} key={label} label={label} rawValue={address} value={formatAddress(address)} />)}
    <Metric copyValue={deployment.marketId} label="Market ID" rawValue={deployment.marketId} value={formatAddress(deployment.marketId)} />
  </dl></Panel>;
}

export function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="panel" aria-labelledby={`${title.toLowerCase().replaceAll(" ", "-")}-title`}><h2 id={`${title.toLowerCase().replaceAll(" ", "-")}-title`}>{title}</h2>{children}</section>;
}
