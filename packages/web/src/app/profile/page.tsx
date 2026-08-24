"use client";

import { useWallet } from "@/lib/wallet-context";
import { useUSDCBalance } from "@/lib/usePoolData";
import { useTickets, useCurrentDraw } from "@/lib/usePoolData";
import { formatUSDC, shortAddress } from "@/lib/format";
import { ConnectButton } from "@/components/ConnectButton";

export default function ProfilePage() {
  const { session, web3AuthReady, pimlicoReady, disconnect } = useWallet();
  const { data: poolData } = useCurrentDraw();
  const currentDrawId = poolData?.[0]?.result?.id as bigint | undefined;

  const { data: usdcData } = useUSDCBalance(session?.smartAccountAddress);
  const usdcBalance = usdcData?.[0]?.result as bigint | undefined;
  const { data: ticketData } = useTickets(
    currentDrawId,
    session?.smartAccountAddress
  );
  const tickets = ticketData?.[0]?.result as bigint | undefined;
  const vaultShares = ticketData?.[1]?.result as bigint | undefined;

  if (!session) {
    return (
      <div className="space-y-4 animate-fade-in">
        <h1 className="font-display text-2xl font-bold">Conta</h1>
        <div className="card text-center space-y-4">
          <p className="text-muted">Entre para ver a sua conta.</p>
          <ConnectButton fullWidth />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <h1 className="font-display text-2xl font-bold">Conta</h1>

      <div className="card space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand to-brandHover grid place-items-center text-white font-bold text-lg">
            {shortAddress(session.smartAccountAddress).slice(1, 3).toUpperCase()}
          </div>
          <div>
            <p className="text-sm text-muted">Smart account</p>
            <p className="font-mono text-sm">{shortAddress(session.smartAccountAddress)}</p>
          </div>
        </div>
        <div className="glass-divider h-px" />
        <div>
          <p className="text-sm text-muted">EOA (assinante)</p>
          <p className="font-mono text-sm text-muted">
            {shortAddress(session.eoaAddress)}
          </p>
        </div>
      </div>

      <div className="card space-y-2">
        <p className="label">Resumo</p>
        <div className="flex justify-between text-sm">
          <span className="text-muted">USDC disponível</span>
          <span className="font-semibold tabular-nums">
            {formatUSDC(usdcBalance)} USDC
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">Na poupança</span>
          <span className="font-semibold tabular-nums">
            {formatUSDC(vaultShares)} USDC
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">Bilhetes (sorteio atual)</span>
          <span className="font-semibold tabular-nums text-brand">
            {tickets !== undefined ? tickets.toString() : "—"}
          </span>
        </div>
      </div>

      <div className="card space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">Login social</span>
          <span>{web3AuthReady ? "✓" : "—"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Gasless (Pimlico)</span>
          <span>{pimlicoReady ? "✓" : "—"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Rede</span>
          <span>Sepolia</span>
        </div>
      </div>

      <button
        onClick={() => void disconnect()}
        className="btn-secondary w-full text-danger"
      >
        Terminar sessão
      </button>
    </div>
  );
}
