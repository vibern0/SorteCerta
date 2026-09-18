import { describe, expect, it } from "vitest";

import { watchProtocolBlocks } from "./watch";

describe("watchProtocolBlocks", () => {
  it("refreshes once for each new chain block and stops after cleanup", () => {
    let onBlockNumber: ((blockNumber: bigint) => void) | undefined;
    let stopped = false;
    let refreshes = 0;
    const stop = watchProtocolBlocks(
      {
        watchBlockNumber(options) {
          onBlockNumber = options.onBlockNumber;
          return () => {
            stopped = true;
          };
        },
      },
      () => {
        refreshes += 1;
      }
    );

    expect(refreshes).toBe(0);
    onBlockNumber?.(124n);
    onBlockNumber?.(125n);
    expect(refreshes).toBe(2);

    stop();
    expect(stopped).toBe(true);
  });
});
