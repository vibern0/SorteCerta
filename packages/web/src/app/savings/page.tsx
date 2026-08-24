"use client";

import { useState } from "react";
import { useWallet } from "@/lib/wallet-context";
import { useTickets, useUSDCBalance } from "@/lib/usePoolData";
import { useCurrentDraw } from "@/lib/usePoolData";
import {
  approveUSDC,
  depositAndBuyTickets,
  redeemShares,
} from "@/lib/web3auth";
import { formatUSDC, parseUSDC } from "@/lib/format";
import { ConnectButton } from "@/components/ConnectButton";

type Mode = "deposit" | "withdraw";

const QUICK_AMOUNTS = ["10", "25", "50", "100"];

export default function SavingsPage() {
  const { session, pimlicoReady } = useWallet();
  const [mode, setMode] = useState<Mode>("deposit");
  const [amount, setAmount] = useState("25");
  const [pending, setPending] = useState(false);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const { data: poolData } = useCurrentDraw();
  const currentDrawId = poolData?.[0]?.result?.id as bigint | undefined;

  const { data: usdcData } = useUSDCBalance(session?.smartAccountAddress);
  const usdcBalance = usdcData?.[0]?.result as bigint | undefined;
  const allowance = usdcData?.[1]?.result as bigint | undefined;

  const { data: ticketData } = useTickets(
    currentDrawId,
    session?.smartAccountAddress
  );
  const tickets = ticketData?.[0]?.result as bigint | undefined;
  const vaultShares = ticketData?.[1]?.result as bigint | undefined;

  if (!session) {
    return (
      <div className="space-y-4 animate-fade-in">
        <h1 className="font-display text-2xl font-bold">Poupar</h1>
        <div className="card text-center space-y-4">
          <p className="text-muted">Entre para começar a poupar.</p>
          <ConnectButton fullWidth />
        </div>
      </div>
    );
  }

  async function onSubmit() {
    setErrMsg(null);
    setLastTx(null);
    if (!session) return;
    let value: bigint;
    try {
      value = parseUSDC(amount);
    } catch (e: any) {
      setErrMsg(e.message);
      return;
    }
    if (value === 0n) {
      setErrMsg("Valor inválido");
      return;
    }

    setPending(true);
    try {
      if (mode === "deposit") {
        // One-time USDC approve if needed.
        if ((allowance ?? 0n) < value) {
          await approveUSDC(session, value);
        }
        const tx = await depositAndBuyTickets(session, value);
        setLastTx(tx);
      } else {
        const tx = await redeemShares(session, value);
        setLastTx(tx);
      }
    } catch (e: any) {
      setErrMsg(e?.shortMessage ?? e?.message ?? "Erro ao enviar transação");
    } finally {
      setPending(false);
    }
  }

  const balance = mode === "deposit" ? usdcBalance : vaultShares;
  const insufficient =
    balance !== undefined && amount.length > 0 && parseUSDC(amount || "0") > balance;

  return (
    <div className="space-y-5 animate-fade-in">
      <h1 className="font-display text-2xl font-bold">Poupar</h1>

      {/* Summary */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-muted text-sm">USDC disponível</span>
          <span className="font-semibold tabular-nums">
            {formatUSDC(usdcBalance)} USDC
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted text-sm">Bilhetes (sorteio atual)</span>
          <span className="font-semibold tabular-nums text-brand">
            {tickets !== undefined ? tickets.toString() : "—"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted text-sm">Na poupança (vault)</span>
          <span className="font-semibold tabular-nums">
            {formatUSDC(vaultShares)} USDC
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface2 p-1 rounded-xl">
        {(["deposit", "withdraw"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`font-display flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
              mode === m ? "bg-bg text-text" : "text-muted hover:text-text"
            }`}
          >
            {m === "deposit" ? "Depositar" : "Levantar"}
          </button>
        ))}
      </div>

      {/* Form */}
      <div className="card space-y-4">
        <div className="space-y-2">
          <label className="label">Valor (USDC)</label>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input text-2xl font-semibold tabular-nums"
            placeholder="0"
          />
          <div className="flex gap-2">
            {QUICK_AMOUNTS.map((a) => (
              <button
                key={a}
                onClick={() => setAmount(a)}
                className="btn-ghost !py-1 !px-3 !text-xs bg-surface2"
              >
                {a}
              </button>
            ))}
            <button
              onClick={() => setAmount(balance !== undefined ? formatUSDC(balance) : "0")}
              className="btn-ghost !py-1 !px-3 !text-xs bg-surface2 ml-auto"
            >
              Máx
            </button>
          </div>
        </div>

        {insufficient && (
          <p className="text-sm text-danger">
            Saldo insuficiente.
          </p>
        )}

        <button
          onClick={() => void onSubmit()}
          disabled={pending || insufficient}
          className="btn-primary w-full"
        >
          {pending ? (
            <>
              <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              A enviar…
            </>
          ) : mode === "deposit" ? (
            "Depositar e comprar bilhetes"
          ) : (
            "Levantar para a minha conta"
          )}
        </button>

        {lastTx && (
          <p className="text-xs text-success break-all">
            ✓ Tx: {lastTx}
          </p>
        )}
        {errMsg && <p className="text-sm text-danger">{errMsg}</p>}

        <p className="text-xs text-muted leading-relaxed">
          {mode === "deposit"
            ? "Os seus fundos ficam na poupança. Pode levantar a qualquer momento. Cada USDC conta como um bilhete para o sorteio atual."
            : "Os USDC voltam para a sua conta imediatamente. A transação não altera os seus bilhetes."}
          {pimlicoReady && " Sem gas — o Pimlico paga."}
        </p>
      </div>
    </div>
  );
}
