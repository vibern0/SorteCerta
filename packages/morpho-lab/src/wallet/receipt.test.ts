import { describe, expect, it } from "vitest";
import type { Hash, PublicClient } from "viem";
import { waitForActionReceipt } from "./receipt";

const original = `0x${"1".repeat(64)}` as Hash;
const replacement = `0x${"2".repeat(64)}` as Hash;
const transaction = {
  to: "0x1111111111111111111111111111111111111111",
  input: "0x1234",
  value: 0n,
};

describe("action receipts", () => {
  it.each([
    "cancelled",
    "replaced",
    "changed calldata",
    "changed value",
    "changed destination",
  ])("rejects %s even when its receipt succeeds", async (kind) => {
    let continued = false;
    const client = {
      waitForTransactionReceipt: async ({ onReplaced }: any) => {
        onReplaced({
          reason:
            kind === "cancelled" || kind === "replaced" ? kind : "repriced",
          replacedTransaction: transaction,
          transaction: {
            ...transaction,
            hash: replacement,
            ...(kind === "changed calldata" ? { input: "0xabcd" } : {}),
            ...(kind === "changed value" ? { value: 1n } : {}),
            ...(kind === "changed destination"
              ? { to: "0x2222222222222222222222222222222222222222" }
              : {}),
          },
        });
        return {
          status: "success",
          transactionHash: replacement,
          blockNumber: 3n,
        };
      },
    } as unknown as PublicClient;
    await expect(
      waitForActionReceipt(client, original, () => {}).then(() => {
        continued = true;
      })
    ).rejects.toThrow(/cancel|replac/i);
    expect(continued).toBe(false);
  });

  it("tracks speed-up hashes and returns the mined receipt", async () => {
    const hashes: Hash[] = [];
    const client = {
      waitForTransactionReceipt: async ({ onReplaced }: any) => {
        onReplaced({
          reason: "repriced",
          replacedTransaction: transaction,
          transaction: { ...transaction, hash: replacement },
        });
        return {
          status: "success",
          transactionHash: replacement,
          blockNumber: 3n,
        };
      },
    } as unknown as PublicClient;
    expect(
      (
        await waitForActionReceipt(client, original, (hash) =>
          hashes.push(hash)
        )
      ).transactionHash
    ).toBe(replacement);
    expect(hashes).toEqual([replacement]);
  });
});
