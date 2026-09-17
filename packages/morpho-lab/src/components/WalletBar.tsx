import { formatEther } from "viem";

import { useMetaMask } from "../wallet/MetaMaskProvider";

export function WalletBar({ ethBalance }: { ethBalance?: bigint }) {
  const {
    account,
    chainId,
    connect,
    error,
    status,
    switchToConfiguredChain,
  } = useMetaMask();
  const onConfiguredChain = chainId === 11155111;

  return (
    <section aria-labelledby="wallet-title">
      <h2 id="wallet-title">Wallet</h2>
      <dl>
        <div>
          <dt>MetaMask</dt>
          <dd>{status}</dd>
        </div>
        <div>
          <dt>Account</dt>
          <dd>{account ?? "Not connected"}</dd>
        </div>
        <div>
          <dt>Chain ID</dt>
          <dd>{chainId ?? "Unavailable"}</dd>
        </div>
        <div>
          <dt>ETH balance</dt>
          <dd>{ethBalance === undefined ? "Unavailable" : `${formatEther(ethBalance)} ETH`}</dd>
        </div>
      </dl>
      {status !== "connected" && status !== "missing" ? (
        <button type="button" onClick={() => void connect()} disabled={status === "connecting"}>
          {status === "connecting" ? "Connecting..." : "Connect MetaMask"}
        </button>
      ) : null}
      {status === "missing" ? <p>MetaMask provider is unavailable.</p> : null}
      {status === "connected" && !onConfiguredChain ? (
        <button type="button" onClick={() => void switchToConfiguredChain()}>
          Switch to Sepolia
        </button>
      ) : null}
      {error === undefined ? null : <p role="alert">{error}</p>}
    </section>
  );
}
