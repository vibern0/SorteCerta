import { describe, expect, it } from "vitest";

import { transactionReducer } from "./transaction-state";

describe("transactionReducer", () => {
  it("tracks a submitted transaction until confirmation", () => {
    const submitted = transactionReducer([], {
      type: "submitted",
      id: "borrow-1",
      summary: "Borrow 1 USDC",
      hash: "0xabc",
    });
    expect(submitted[0].status).toBe("pending");
    expect(transactionReducer(submitted, { type: "confirmed", id: "borrow-1", blockNumber: 12n })[0].status)
      .toBe("confirmed");
  });

  it("keeps the original summary when a signature is rejected", () => {
    const submitted = transactionReducer([], {
      type: "submitted",
      id: "supply-1",
      summary: "Supply 1 USDC",
      hash: "0xdef",
    });

    const rejected = transactionReducer(submitted, {
      type: "failed",
      id: "supply-1",
      error: "User rejected the request.",
    });

    expect(rejected[0]).toMatchObject({
      summary: "Supply 1 USDC",
      status: "failed",
      error: "User rejected the request.",
    });
  });

  it("keeps the original summary when a receipt is reverted", () => {
    const submitted = transactionReducer([], {
      type: "submitted",
      id: "withdraw-1",
      summary: "Withdraw 1 USDC",
      hash: "0x123",
    });

    const reverted = transactionReducer(submitted, {
      type: "failed",
      id: "withdraw-1",
      error: "Transaction reverted onchain.",
    });

    expect(reverted[0]).toMatchObject({
      summary: "Withdraw 1 USDC",
      status: "failed",
      error: "Transaction reverted onchain.",
    });
  });
});
