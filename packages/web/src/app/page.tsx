"use client";

import Link from "next/link";
import { useState } from "react";
import { ConnectButton } from "@/components/ConnectButton";
import { Countdown } from "@/components/Countdown";
import { useCurrentDraw, useUSDCBalance } from "@/lib/usePoolData";
import { useWallet } from "@/lib/wallet-context";
import { formatUSDC } from "@/lib/format";

export default function HomePage() {
  const { session } = useWallet();
  const [addressCopied, setAddressCopied] = useState(false);
  const { data: poolData } = useCurrentDraw();
  const draw = poolData?.[0]?.result as
    | { endTime: bigint; prizeAmount: bigint; id: bigint }
    | undefined;
  const { data: usdcData } = useUSDCBalance(session?.address);
  const usdcBalance = usdcData?.[0]?.result as bigint | undefined;

  async function copyAddress() {
    if (!session?.address) return;
    await navigator.clipboard.writeText(session.address);
    setAddressCopied(true);
    window.setTimeout(() => setAddressCopied(false), 1800);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero */}
      <section className="space-y-3">
        <div className="inline-flex">
          <span className="pill">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            Sepolia testnet
          </span>
        </div>
        <h1 className="font-display text-4xl font-bold leading-tight tracking-tight">
          A sua poupança,
          <br />
          com sorte.
        </h1>
        <p className="text-muted leading-relaxed">
          Ponha dinheiro a render. Receba bilhetes para um sorteio todas as
          semanas. O seu capital fica sempre disponível — é só levantar.
        </p>
      </section>

      {/* Next draw */}
      {draw && (
        <section className="card space-y-2">
          <p className="label">Próximo sorteio #{draw.id.toString()}</p>
          <Countdown target={draw.endTime} />
          <div className="flex items-center justify-between pt-2 text-sm">
            <span className="text-muted">Prémio atual</span>
            <span className="font-semibold text-text tabular-nums">
              {formatUSDC(draw.prizeAmount)} USDC
            </span>
          </div>
        </section>
      )}

      {/* Balance (if connected) */}
      {session && (
        <section className="card space-y-3">
          <p className="label">A sua conta</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted text-sm">Smart account</span>
              <button
                type="button"
                onClick={() => void copyAddress()}
                className="btn-secondary !px-3 !py-1.5 !text-xs"
              >
                {addressCopied ? "Copiado" : "Copiar"}
              </button>
            </div>
            <p className="break-all rounded-2xl bg-white/30 px-3 py-2 text-xs text-muted">
              {session.address}
            </p>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-muted">Saldo USDC</span>
            <span className="font-display text-2xl font-bold tabular-nums">
              {formatUSDC(usdcBalance)} <span className="text-muted text-base">USDC</span>
            </span>
          </div>
          <Link href="/savings" className="btn-primary w-full">
            Depositar / Levantar
          </Link>
        </section>
      )}

      {/* Connect */}
      {!session && (
        <section className="card space-y-4">
          <p className="label">Começar</p>
          <p className="text-muted text-sm">
            Entre com a sua conta Google ou Apple. Sem palavras-passe, sem
            extensões, sem taxas escondidas.
          </p>
          <ConnectButton fullWidth />
        </section>
      )}

      {/* How it works */}
      <section className="space-y-3">
        <p className="label">Como funciona</p>
        <ol className="space-y-3">
          {[
            { n: 1, t: "Deposite", d: "USDC entra numa poupança — fica disponível a qualquer momento." },
            { n: 2, t: "Receba bilhetes", d: "Cada USDC conta como um bilhete para o sorteio da semana." },
            { n: 3, t: "Ganhe sem perder", d: "O prémio vem do rendimento. O seu capital volta sempre." },
          ].map((s) => (
            <li key={s.n} className="flex gap-3 card !p-4">
              <div className={`w-8 h-8 rounded-xl font-bold grid place-items-center flex-shrink-0 ${s.n % 2 === 0 ? "accent-cyan" : "accent-rose"}`}>
                {s.n}
              </div>
              <div>
                <p className="font-display font-semibold">{s.t}</p>
                <p className="text-sm text-muted">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <p className="text-xs text-muted text-center pt-4">
        Versão de teste na rede Sepolia. Sem fundos reais.{" "}
        <Link href="/draw" className="text-brand hover:underline">
          Ver próximo sorteio
        </Link>
      </p>
    </div>
  );
}
