"use client";

import { useWallet } from "@/lib/wallet-context";
import { shortAddress } from "@/lib/format";

export function ConnectButton({ fullWidth = false }: { fullWidth?: boolean }) {
  const { session, connect, connecting, error, web3AuthReady, pimlicoReady } = useWallet();

  if (session) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted">
        <span className="w-2 h-2 rounded-full bg-success" />
        <span>Carteira ativa: {shortAddress(session.eoaAddress)}</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={() => void connect()}
        disabled={connecting || !web3AuthReady}
        className={`btn-primary ${fullWidth ? "w-full" : ""}`}
      >
        {connecting ? (
          <>
            <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            A abrir o login…
          </>
        ) : (
          <>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21.35 11.1H12v3.83h5.34c-.51 2.4-2.6 4.07-5.34 4.07-3.2 0-5.83-2.62-5.83-5.83s2.63-5.83 5.83-5.83c1.45 0 2.76.5 3.77 1.4l2.7-2.7C16.83 4.51 14.55 3.5 12 3.5 7.31 3.5 3.5 7.31 3.5 12s3.81 8.5 8.5 8.5c4.92 0 8.35-3.45 8.35-8.34 0-.55-.05-1.05-.13-1.56z" />
            </svg>
            Entrar com Google / Apple
          </>
        )}
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
      {!web3AuthReady && (
        <p className="text-xs text-warning">
          Web3Auth não configurado. Define <code>NEXT_PUBLIC_WEB3AUTH_CLIENT_ID</code>.
        </p>
      )}
      {web3AuthReady && !pimlicoReady && (
        <p className="text-xs text-warning">
          Pimlico (gasless) não configurado.
        </p>
      )}
    </div>
  );
}
