import { describe, expect, it } from "vitest";

import { getCloseDrawState } from "./operator-state";

describe("getCloseDrawState", () => {
  it("keeps a ready draw closable when the dashboard snapshot is stale", () => {
    const state = getCloseDrawState({
      account: "0x1111111111111111111111111111111111111111",
      busy: false,
      chainId: 11155111,
      nextDrawAt: 1_000n,
      now: 1_001,
      stale: true,
      status: "connected",
    });

    expect(state.disabled).toBe(false);
    expect(state.ready).toBe(true);
    expect(state.reason).toBeUndefined();
  });

  it("waits until the scheduled draw time", () => {
    const state = getCloseDrawState({
      account: "0x1111111111111111111111111111111111111111",
      busy: false,
      chainId: 11155111,
      nextDrawAt: 1_001n,
      now: 1_000,
      stale: false,
      status: "connected",
    });

    expect(state.disabled).toBe(true);
    expect(state.ready).toBe(false);
    expect(state.reason).toBe("Draw closes at the scheduled time.");
  });
});
