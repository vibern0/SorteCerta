import { formatPercent, formatTimestamp, formatToken } from "../format";
import type { MorphoMarketSnapshot } from "../types";
import { Metric } from "./Metric";
import { MarketParamsMetrics } from "./AdapterPanel";
import { Panel } from "./DeploymentPanel";

export function MarketPanel({ market }: { market: MorphoMarketSnapshot }) {
  const state = market.state;
  const supplierApr = market.supplierRatePerSecond === undefined ? undefined : market.supplierRatePerSecond * 31_536_000n;
  return <Panel title="Morpho Market"><dl className="metric-grid">
    <Metric label="Total supply assets" rawValue={state.totalSupplyAssets.toString()} value={`${formatToken(state.totalSupplyAssets)} USDC`} />
    <Metric label="Total supply shares" rawValue={state.totalSupplyShares.toString()} value={state.totalSupplyShares.toString()} />
    <Metric label="Total borrow assets" rawValue={state.totalBorrowAssets.toString()} value={`${formatToken(state.totalBorrowAssets)} USDC`} />
    <Metric label="Total borrow shares" rawValue={state.totalBorrowShares.toString()} value={state.totalBorrowShares.toString()} />
    <Metric label="Available liquidity" rawValue={market.liquidity.toString()} value={`${formatToken(market.liquidity)} USDC`} />
    <Metric label="Estimated supplier APR" rawValue={supplierApr?.toString()} value={formatPercent(supplierApr)} />
    <Metric label="Last update" rawValue={state.lastUpdate.toString()} value={formatTimestamp(state.lastUpdate)} />
    <Metric label="Fee" rawValue={state.fee.toString()} value={formatPercent(state.fee)} />
    <Metric label="Oracle price" rawValue={market.oraclePrice.toString()} value={market.oraclePrice.toString()} />
    <Metric label="Borrow rate / second" rawValue={market.borrowRatePerSecond?.toString()} value={market.borrowRatePerSecond?.toString() ?? "Unavailable"} />
    <Metric label="Utilization" rawValue={market.utilizationWad?.toString()} value={formatPercent(market.utilizationWad)} />
    <MarketParamsMetrics params={market.params} />
  </dl></Panel>;
}
