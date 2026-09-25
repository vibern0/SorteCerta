import type { ProjectedMorphoYield } from "@sortecerta/protocol";

export {
  projectMorphoYield,
  readProjectedMorphoYield,
  type ProjectedMorphoYield,
} from "@sortecerta/protocol";

type BlockSnapshot = {
  blockNumber: bigint;
  source?: ProjectedMorphoYield["source"];
};

export function createLatestBlockRefresher<T extends BlockSnapshot>(
  readSnapshot: (blockNumber?: bigint) => Promise<T>,
  applySnapshot: (snapshot: T) => void,
  onError: (error: unknown) => void = () => undefined,
) {
  let latestApplied: { blockNumber: bigint; quality: number } | undefined;
  let disposed = false;

  return {
    async refresh(blockNumber?: bigint): Promise<void> {
      if (disposed) return;
      try {
        const snapshot = await readSnapshot(blockNumber);
        const quality = snapshot.source === "projected" ? 1 : 0;
        if (
          disposed ||
          (latestApplied !== undefined &&
            (snapshot.blockNumber < latestApplied.blockNumber ||
              (snapshot.blockNumber === latestApplied.blockNumber && quality <= latestApplied.quality)))
        ) return;
        latestApplied = { blockNumber: snapshot.blockNumber, quality };
        applySnapshot(snapshot);
      } catch (error) {
        if (!disposed) onError(error);
      }
    },
    dispose(): void {
      disposed = true;
    },
  };
}
