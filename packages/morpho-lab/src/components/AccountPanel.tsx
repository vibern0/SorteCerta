import { blockscoutAddressUrl, formatAddress, formatPercent, formatToken } from "../format";
import type { AccountSnapshot } from "../types";
import { Metric } from "./Metric";
import { Panel } from "./DeploymentPanel";

export function AccountPanel({ account }: { account?: AccountSnapshot }) {
  if (account === undefined) return <Panel title="Account"><p className="empty-state">Connect MetaMask to read account state.</p></Panel>;
  const { position, health, tokens } = account;
  return <Panel title="Account"><dl className="metric-grid">
    <Metric copyValue={account.address} href={blockscoutAddressUrl(account.address)} label="Address" rawValue={account.address} value={formatAddress(account.address)} />
    <Metric label="Supply shares" rawValue={position.supplyShares.toString()} value={position.supplyShares.toString()} />
    <Metric label="Borrow shares" rawValue={position.borrowShares.toString()} value={position.borrowShares.toString()} />
    <Metric label="Collateral assets" rawValue={position.collateralAssets.toString()} value={`${formatToken(position.collateralAssets, 18)} WETH`} />
    <Metric label="Collateral value" rawValue={health.collateralValue.toString()} value={health.collateralValue.toString()} />
    <Metric label="Borrow limit" rawValue={health.borrowLimit.toString()} value={health.borrowLimit.toString()} />
    <Metric label="Borrow assets" rawValue={health.borrowAssets.toString()} value={`${formatToken(health.borrowAssets)} USDC`} />
    <Metric label="LTV" rawValue={health.ltvWad?.toString()} value={formatPercent(health.ltvWad)} />
    <Metric label="Liquidatable" rawValue={String(health.liquidatable)} value={health.liquidatable ? "Yes" : "No"} />
    <Metric label="USDC balance" rawValue={tokens.usdcBalance.toString()} value={`${formatToken(tokens.usdcBalance)} USDC`} />
    <Metric label="USDC allowance" rawValue={tokens.usdcAllowance.toString()} value={`${formatToken(tokens.usdcAllowance)} USDC`} />
    <Metric copyValue={tokens.confidentialUsdcHandle} label="Encrypted handle" rawValue={tokens.confidentialUsdcHandle} value={formatAddress(tokens.confidentialUsdcHandle)} />
    <Metric copyValue={account.encryptedPrincipalHandle} label="Encrypted handle" rawValue={account.encryptedPrincipalHandle} value={formatAddress(account.encryptedPrincipalHandle)} />
    <Metric copyValue={account.encryptedWinningsHandle} label="Encrypted handle" rawValue={account.encryptedWinningsHandle} value={formatAddress(account.encryptedWinningsHandle)} />
  </dl></Panel>;
}
