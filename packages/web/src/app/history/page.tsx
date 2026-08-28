"use client";

import { useEffect, useState } from "react";
import { useReadContracts } from "wagmi";
import { CONTRACTS, prizePoolAbi } from "@/lib/contracts";
import { formatUSDC, shortAddress } from "@/lib/format";

type DrawRow = {
  id: bigint;
  startTime: bigint;
  endTime: bigint;
  prizeAmount: bigint;
  winner: string;
  fulfilled: boolean;
};

// History page for recent draws from the legacy plaintext prize pool.
export default function HistoryPage() {
  const [maxId, setMaxId] = useState<bigint>(0n);
  const [fetched, setFetched] = useState<DrawRow[]>([]);
  const [loading, setLoading] = useState(true);

  // First, grab currentDrawId to know how far to look back.
  const { data: cd } = useReadContracts({
    contracts: [
      {
        address: CONTRACTS.prizePool,
        abi: prizePoolAbi,
        functionName: "currentDrawId",
      },
    ],
  });
  const currentDrawId = cd?.[0]?.result as bigint | undefined;

  useEffect(() => {
    if (currentDrawId === undefined) return;
    setMaxId(currentDrawId);
  }, [currentDrawId]);

  // Then load all historical draws in one batch (cap at last 20 for now).
  const ids = Array.from({ length: 20 }, (_, i) => maxId - BigInt(i)).filter(
    (n) => n > 0n
  );

  const { data: rows, isLoading } = useReadContracts({
    contracts: ids.map((id) => ({
      address: CONTRACTS.prizePool,
      abi: prizePoolAbi,
      functionName: "draws",
      args: [id] as const,
    })),
    query: { enabled: ids.length > 0 },
  });

  useEffect(() => {
    if (!rows) return;
    const items: DrawRow[] = rows
      .map((r) => r.result as DrawRow | undefined)
      .filter((r): r is DrawRow => Boolean(r && r.id));
    setFetched(items.sort((a, b) => Number(b.id - a.id)));
    setLoading(false);
  }, [rows]);

  return (
    <div className="space-y-5 animate-fade-in">
      <h1 className="font-display text-2xl font-bold">History</h1>

      {loading || isLoading ? (
        <div className="card text-muted text-center py-10">Loading...</div>
      ) : fetched.length === 0 ? (
        <div className="card text-muted text-center py-10">
          No completed draws yet.
        </div>
      ) : (
        <div className="space-y-2">
          {fetched.map((d) => (
            <div key={d.id.toString()} className="card !p-4 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-display text-lg font-bold">
                  #{d.id.toString()}
                </span>
                <span
                  className={`pill ${
                    d.fulfilled
                      ? "text-success"
                      : new Date() > new Date(Number(d.endTime) * 1000)
                      ? "text-warning"
                      : "text-muted"
                  }`}
                >
                  {d.fulfilled
                    ? "Completed"
                    : new Date() > new Date(Number(d.endTime) * 1000)
                    ? "Ready to close"
                    : "Open"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Prize</span>
                <span className="font-semibold tabular-nums">
                  {formatUSDC(d.prizeAmount)} USDC
                </span>
              </div>
              {d.fulfilled && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Winner</span>
                  <span className="font-mono text-xs">
                    {d.winner === "0x0000000000000000000000000000000000000000"
                      ? "—"
                      : shortAddress(d.winner)}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
