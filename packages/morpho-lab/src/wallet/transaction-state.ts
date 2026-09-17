import type { Hash } from "viem";

export type TransactionRecord = {
  id: string;
  summary: string;
  status: "pending" | "confirmed" | "failed";
  hash?: Hash;
  blockNumber?: bigint;
  error?: string;
};

export type TransactionEvent =
  | { type: "submitted"; id: string; summary: string; hash: Hash }
  | { type: "confirmed"; id: string; blockNumber: bigint }
  | { type: "failed"; id: string; error: string; summary?: string };

export function transactionReducer(
  state: TransactionRecord[],
  event: TransactionEvent
): TransactionRecord[] {
  if (event.type === "submitted") {
    return [
      {
        id: event.id,
        summary: event.summary,
        hash: event.hash,
        status: "pending",
      },
      ...state,
    ];
  }

  const existing = state.find((record) => record.id === event.id);
  if (event.type === "failed" && existing === undefined) {
    return [
      {
        id: event.id,
        summary: event.summary ?? "Transaction",
        status: "failed",
        error: event.error,
      },
      ...state,
    ];
  }

  return state.map((record) => {
    if (record.id !== event.id) return record;

    if (event.type === "confirmed") {
      return { ...record, status: "confirmed", blockNumber: event.blockNumber };
    }

    return { ...record, status: "failed", error: event.error };
  });
}
