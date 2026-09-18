export type ProtocolBlockWatcher = {
  watchBlockNumber(options: {
    emitOnBegin?: boolean;
    onBlockNumber(blockNumber: bigint): void;
  }): () => void;
};

export function watchProtocolBlocks(
  client: ProtocolBlockWatcher,
  refresh: () => void
): () => void {
  return client.watchBlockNumber({
    emitOnBegin: false,
    onBlockNumber: refresh,
  });
}
