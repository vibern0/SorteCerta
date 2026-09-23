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
          onBlockNumber = (blockNumber) => {
            options.onBlockNumber(blockNumber);
          };
          return () => {
            stopped = true;
          };
        },
      },
      () => {
        refreshes += 1;
      },
      () => {},
    );

    expect(refreshes).toBe(0);
    onBlockNumber?.(124n);
    onBlockNumber?.(125n);
    expect(refreshes).toBe(2);

    stop();
    expect(stopped).toBe(true);
  });

  it("surfaces polling errors and recovers on the next successful refresh", () => {
    let onBlockNumber: ((blockNumber: bigint) => void) | undefined;
    let onError: ((error: Error) => void) | undefined;
    let status = "Current";
    watchProtocolBlocks(
      {
        watchBlockNumber(options) {
          onBlockNumber = (blockNumber) => {
            options.onBlockNumber(blockNumber);
          };
          onError = (error) => {
            options.onError(error);
          };
          return () => {};
        },
      },
      () => {
        status = "Current";
      },
      (error) => {
        status = error.message;
      },
    );

    onError?.(new Error("RPC unavailable"));
    expect(status).toBe("RPC unavailable");

    onBlockNumber?.(124n);
    expect(status).toBe("Current");
  });
});
