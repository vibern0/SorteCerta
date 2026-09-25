import type { LabConfig } from "../config";
import type { ProtocolSnapshot } from "../types";

export type ProtocolViewProps = {
  config: LabConfig;
  snapshot: ProtocolSnapshot;
  refresh: () => Promise<ProtocolSnapshot>;
  stale: boolean;
};
