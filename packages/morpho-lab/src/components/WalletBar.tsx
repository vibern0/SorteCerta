import { formatEther } from "viem";

import { useMetaMask } from "../wallet/MetaMaskProvider";

export function WalletBar({ ethBalance }: { ethBalance?: bigint }) {
  const wallet = useMetaMask();
  const onConfiguredChain = wallet.chainId === 11155111;

  return (
    <section aria-labelledby="wallet-title">
      <h2 id="wallet-title">Wallet</h2>
      <dl>
        <div>
          <dt>MetaMask</dt>
          <dd>{wallet.status}</dd>
        </div>
        <div>
          <dt>Account</dt>
          <dd>{wallet.account ?? "Not connected"}</dd>
        </div>
        <div>
          <dt>Chain ID</dt>
          <dd>{wallet.chainId ?? "Unavailable"}</dd>
        </div>
        <div>
          <dt>ETH balance</dt>
          <dd>{ethBalance === undefined ? "Unavailable" : `${formatEther(ethBalance)} ETH`}</dd>
        </div>
      </dl>
      {wallet.status !== "connected" && wallet.status !== "missing" ? (
        <button
          type="button"
          onClick={() => void wallet.connect()}
          disabled={wallet.status === "connecting"}
        >
          {wallet.status === "connecting" ? "Connecting..." : "Connect MetaMask"}
        </button>
      ) : null}
      {wallet.status === "missing" ? (
        <p>MetaMask provider is unavailable.</p>
      ) : null}
      {wallet.status === "connected" && !onConfiguredChain ? (
        <button
          type="button"
          onClick={() => void wallet.switchToConfiguredChain()}
        >
          Switch to Sepolia
        </button>
      ) : null}
      {wallet.error === undefined ? null : <p role="alert">{wallet.error}</p>}
    </section>
  );
}
