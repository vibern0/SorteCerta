"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/lib/wallet-context";
import { useUSDCBalance } from "@/lib/usePoolData";
import { formatUSDC, shortAddress } from "@/lib/format";
import { ConnectButton } from "@/components/ConnectButton";
import { decryptConfidentialBalances } from "@/lib/confidential-balances";

export default function ProfilePage() {
  const { session, web3AuthReady, pimlicoReady, disconnect } = useWallet();
  const [confidentialBalance, setConfidentialBalance] = useState<bigint | undefined>();
  const [principal, setPrincipal] = useState<bigint | undefined>();
  const [decrypting, setDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState<string | null>(null);

  const { data: usdcData } = useUSDCBalance(session?.address);
  const usdcBalance = usdcData?.[0]?.result as bigint | undefined;

  useEffect(() => {
    if (!session) {
      setConfidentialBalance(undefined);
      setPrincipal(undefined);
      setDecryptError(null);
      return;
    }

    let cancelled = false;
    const currentSession = session;

    async function decrypt() {
      setDecrypting(true);
      setDecryptError(null);
      try {
        const balances = await decryptConfidentialBalances(currentSession);
        if (cancelled) return;
        setConfidentialBalance(balances.confidentialBalance);
        setPrincipal(balances.principal);
      } catch (error) {
        if (cancelled) return;
        setDecryptError(error instanceof Error ? error.message : String(error));
      } finally {
        if (!cancelled) setDecrypting(false);
      }
    }

    void decrypt();

    return () => {
      cancelled = true;
    };
  }, [session]);

  if (!session) {
    return (
      <div className="space-y-4 animate-fade-in">
        <h1 className="font-display text-2xl font-bold">Account</h1>
        <div className="card text-center space-y-4">
          <p className="text-muted">Sign in to view your account.</p>
          <ConnectButton fullWidth />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <h1 className="font-display text-2xl font-bold">Account</h1>

      <div className="card space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand to-brandHover grid place-items-center text-white font-bold text-lg">
            {shortAddress(session.address).slice(1, 3).toUpperCase()}
          </div>
          <div>
            <p className="text-sm text-muted">Smart account</p>
            <p className="font-mono text-sm">{shortAddress(session.address)}</p>
          </div>
        </div>
      </div>

      <div className="card space-y-2">
        <p className="label">Summary</p>
        <div className="flex justify-between text-sm">
          <span className="text-muted">Available USDC</span>
          <span className="font-semibold tabular-nums">
            {formatUSDC(usdcBalance)} USDC
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">Decrypted cUSDC</span>
          <span className="font-semibold tabular-nums">
            {decrypting ? "Decrypting..." : `${formatUSDC(confidentialBalance)} cUSDC`}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">Principal in pool</span>
          <span className="font-semibold tabular-nums text-brand">
            {decrypting ? "Decrypting..." : `${formatUSDC(principal)} cUSDC`}
          </span>
        </div>
        {decryptError && <p className="text-xs text-danger">{decryptError}</p>}
      </div>

      <div className="card space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">Social login</span>
          <span>{web3AuthReady ? "✓" : "—"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Gasless (Pimlico)</span>
          <span>{pimlicoReady ? "✓" : "—"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Network</span>
          <span>Sepolia</span>
        </div>
      </div>

      <button
        onClick={() => void disconnect()}
        className="btn-secondary w-full text-danger"
      >
        Sign out
      </button>
    </div>
  );
}
