import { blockscoutAddressUrl, formatAddress, formatPercent, formatToken } from "../format";
import type { AdapterSnapshot, MarketParams } from "../types";
import type { Address } from "viem";
import { Metric } from "./Metric";
import { Panel } from "./DeploymentPanel";

function MarketParamsMetrics({ params }: { params: MarketParams }) {
  const addresses: Array<[string, Address]> = [
    ["Loan token", params.loanToken], ["Collateral token", params.collateralToken], ["Oracle", params.oracle], ["IRM", params.irm],
  ];
  return <>
    {addresses.map(([label, address]) => <Metric copyValue={address} href={blockscoutAddressUrl(address)} key={label} label={label} rawValue={address} value={formatAddress(address)} />)}
    <Metric label="LLTV" rawValue={params.lltv.toString()} value={formatPercent(params.lltv)} />
  </>;
}

export function AdapterPanel({ adapter }: { adapter: AdapterSnapshot }) {
  const addresses: Array<[string, Address]> = [
    ["USDC", adapter.usdc], ["Confidential USDC", adapter.confidentialUsdc], ["Prize pool", adapter.prizePool], ["Morpho", adapter.morpho],
  ];
  return <Panel title="Yield Adapter"><dl className="metric-grid">
    {addresses.map(([label, address]) => <Metric copyValue={address} href={blockscoutAddressUrl(address)} key={label} label={label} rawValue={address} value={formatAddress(address)} />)}
    <Metric copyValue={adapter.marketId} label="Market ID" rawValue={adapter.marketId} value={formatAddress(adapter.marketId)} />
    <Metric label="Supplied principal" rawValue={adapter.suppliedPrincipal.toString()} value={`${formatToken(adapter.suppliedPrincipal)} USDC`} />
    <Metric label="Idle principal" rawValue={adapter.idlePrincipal.toString()} value={`${formatToken(adapter.idlePrincipal)} USDC`} />
    <Metric label="Available principal" rawValue={adapter.availablePrincipalAssets.toString()} value={`${formatToken(adapter.availablePrincipalAssets)} USDC`} />
    <Metric label="Accrued yield" rawValue={adapter.accruedYieldAssets.toString()} value={`${formatToken(adapter.accruedYieldAssets)} USDC`} />
    <Metric label="Supplied assets" rawValue={adapter.suppliedAssets.toString()} value={`${formatToken(adapter.suppliedAssets)} USDC`} />
    <MarketParamsMetrics params={adapter.marketParams} />
  </dl></Panel>;
}

export { MarketParamsMetrics };
