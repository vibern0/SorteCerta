export type ProtocolBlockWatcher = {
  watchBlockNumber: (options: {
    emitOnBegin?: boolean;
    onBlockNumber: (blockNumber: bigint) => void;
    onError: (error: Error) => void;
  }) => () => void;
};

export function watchProtocolBlocks(
  client: ProtocolBlockWatcher,
  refresh: () => void,
  onError: (error: Error) => void
): () => void {
  return client.watchBlockNumber({
    emitOnBegin: false,
    onBlockNumber: refresh,
    onError,
  });
}
