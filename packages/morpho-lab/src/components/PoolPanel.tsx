import { formatAddress, formatTimestamp, formatToken } from "../format";
import type { PoolSnapshot } from "../types";
import { Metric } from "./Metric";
import { Panel } from "./DeploymentPanel";

export function PoolPanel({ pool }: { pool: PoolSnapshot }) {
  const batch = pool.withdrawalBatch;
  return <Panel title="Prize Pool"><dl className="metric-grid">
    <Metric label="Draw ID" rawValue={pool.drawId.toString()} value={pool.drawId.toString()} />
    <Metric label="Next draw" rawValue={pool.nextDrawAt.toString()} value={formatTimestamp(pool.nextDrawAt)} />
    <Metric label="Participants" rawValue={pool.participantCount.toString()} value={pool.participantCount.toString()} />
    <Metric label="Public prize reserve" rawValue={pool.publicPrizeReserve.toString()} value={`${formatToken(pool.publicPrizeReserve)} USDC`} />
    <Metric label="Pending deposits" rawValue={pool.morphoPendingDepositCount.toString()} value={pool.morphoPendingDepositCount.toString()} />
    <Metric label="Last unwrap" rawValue={pool.lastMorphoUnwrapAt.toString()} value={formatTimestamp(pool.lastMorphoUnwrapAt)} />
    <Metric label="Unwrap interval" rawValue={pool.morphoUnwrapInterval.toString()} value={`${pool.morphoUnwrapInterval.toString()} s`} />
    <Metric copyValue={pool.encryptedTotalPrincipalHandle} label="Encrypted handle" rawValue={pool.encryptedTotalPrincipalHandle} value={formatAddress(pool.encryptedTotalPrincipalHandle)} />
    <Metric copyValue={pool.encryptedPrizeReserveHandle} label="Encrypted handle" rawValue={pool.encryptedPrizeReserveHandle} value={formatAddress(pool.encryptedPrizeReserveHandle)} />
    <Metric copyValue={pool.encryptedPendingMorphoPrincipalHandle} label="Encrypted handle" rawValue={pool.encryptedPendingMorphoPrincipalHandle} value={formatAddress(pool.encryptedPendingMorphoPrincipalHandle)} />
    <Metric label="Withdrawal batch ID" rawValue={batch.id.toString()} value={batch.id.toString()} />
    <Metric label="Withdrawal status" rawValue={batch.status.toString()} value={batch.status.toString()} />
    <Metric label="Withdrawal closes" rawValue={batch.closesAt.toString()} value={formatTimestamp(batch.closesAt)} />
    <Metric label="Withdrawal funded" rawValue={String(batch.funded)} value={batch.funded ? "Yes" : "No"} />
    <Metric label="Withdrawal restored" rawValue={batch.restoredAmount.toString()} value={`${formatToken(batch.restoredAmount)} USDC`} />
    <Metric label="Withdrawal requests" rawValue={batch.requestCount.toString()} value={batch.requestCount.toString()} />
    <Metric label="Withdrawal claimants" rawValue={batch.claimantCount.toString()} value={batch.claimantCount.toString()} />
  </dl></Panel>;
}
