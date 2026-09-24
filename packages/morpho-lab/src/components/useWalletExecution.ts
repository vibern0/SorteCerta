import { useRef } from "react";

import { useMetaMask } from "../wallet/MetaMaskProvider";

export function useWalletExecution() {
  const wallet = useMetaMask();
  const walletRef = useRef(wallet);
  walletRef.current = wallet;

  return {
    running: useRef(false),
    wallet,
    walletRef,
  };
}
