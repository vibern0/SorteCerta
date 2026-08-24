"use client";

import { useState } from "react";
import { Countdown } from "@/components/Countdown";
import { useCurrentDraw } from "@/lib/usePoolData";
import { useWallet } from "@/lib/wallet-context";
import { closeDraw, fundPrizePool } from "@/lib/web3auth";
import { formatUSDC, parseUSDC } from "@/lib/format";

export default function DrawPage() {
  const { session, pimlicoReady } = useWallet();
  const { data: poolData, refetch } = useCurrentDraw();
  const draw = poolData?.[0]?.result as
    | {
        id: bigint;
        startTime: bigint;
        endTime: bigint;
        prizeAmount: bigint;
        winner: string;
        fulfilled: boolean;
      }
    | undefined;

  const [boostAmount, setBoostAmount] = useState("10");
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!draw) {
    return (
      <div className="space-y-3">
        <h1 className="font-display text-2xl font-bold">Sorteio</h1>
        <div className="card text-muted text-center py-10">A carregar…</div>
      </div>
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const ended = now >= Number(draw.endTime);

  async function onBoost() {
    if (!session) return;
    setMsg(null);
    setPending(true);
    try {
      const value = parseUSDC(boostAmount);
      const tx = await fundPrizePool(session, value);
      setMsg(`Prémio reforçado. Tx: ${tx.slice(0, 10)}…`);
      refetch();
    } catch (e: any) {
      setMsg(e?.shortMessage ?? e?.message ?? "Erro");
    } finally {
      setPending(false);
    }
  }

  async function onClose() {
    if (!session) return;
    setMsg(null);
    setPending(true);
    try {
      const tx = await closeDraw(session);
      setMsg(`Sorteio fechado. Tx: ${tx.slice(0, 10)}…`);
      refetch();
    } catch (e: any) {
      setMsg(e?.shortMessage ?? e?.message ?? "Erro");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <h1 className="font-display text-2xl font-bold">Sorteio #{draw.id.toString()}</h1>

      {/* Big countdown card */}
      <div className="card !p-6 text-center space-y-3">
        <p className="label">Tempo restante</p>
        <Countdown target={draw.endTime} />
        <div className="glass-divider h-px my-2" />
        <div className="space-y-1">
          <p className="label">Prémio acumulado</p>
          <p className="font-display text-4xl font-bold tabular-nums">
            {formatUSDC(draw.prizeAmount)} <span className="text-2xl text-muted">USDC</span>
          </p>
        </div>
        {draw.fulfilled && (
          <p className="text-sm text-success">✓ Sorteio fechado</p>
        )}
      </div>

      {/* Sponsor the prize pool */}
      {session && !draw.fulfilled && (
        <div className="card space-y-3">
          <div>
            <p className="label">Reforçar o prémio</p>
            <p className="text-sm text-muted mt-1">
              Qualquer pessoa pode adicionar USDC ao prémio. É assim que o sorteio se finança enquanto não temos rendimento real.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              inputMode="decimal"
              value={boostAmount}
              onChange={(e) => setBoostAmount(e.target.value)}
              className="input"
            />
            <button
              onClick={() => void onBoost()}
              disabled={pending}
              className="btn-secondary whitespace-nowrap"
            >
              Reforçar
            </button>
          </div>
        </div>
      )}

      {/* Close the draw */}
      {session && ended && !draw.fulfilled && (
        <button
          onClick={() => void onClose()}
          disabled={pending}
          className="btn-primary w-full"
        >
          {pending ? "A fechar…" : "Fechar sorteio e escolher vencedor"}
        </button>
      )}

      {msg && <p className="text-sm text-muted break-all">{msg}</p>}

      {/* Info */}
      <div className="card space-y-2 text-sm text-muted">
        <p>
          <span className="text-text font-semibold">Como ganha:</span> o vencedor é
          escolhido por sorteio, com peso proporcional aos seus bilhetes. Quem
          tem mais USDC depositados tem mais hipóteses — mas pode sempre
          levantar tudo a qualquer momento.
        </p>
        <p>
          <span className="text-text font-semibold">No-loss:</span> o prémio vem
          do reforço, não do seu capital.
          {pimlicoReady && " Sem gas."}
        </p>
      </div>
    </div>
  );
}
