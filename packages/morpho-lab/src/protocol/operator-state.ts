import type { Address } from "viem";
import type { MetaMaskContextValue } from "../wallet/MetaMaskProvider";

type CloseDrawStateInput = {
  account?: Address;
  busy: boolean;
  chainId?: number;
  nextDrawAt: bigint;
  now: number;
  stale: boolean;
  status: MetaMaskContextValue["status"];
};

export type CloseDrawState = {
  disabled: boolean;
  ready: boolean;
  reason?: string;
};

export function getCloseDrawState(input: CloseDrawStateInput): CloseDrawState {
  const ready = input.nextDrawAt <= BigInt(input.now);

  if (input.busy) return { disabled: true, ready, reason: "Close draw is already running." };
  if (!ready) return { disabled: true, ready, reason: "Draw closes at the scheduled time." };
  if (input.account === undefined || input.status !== "connected") {
    return { disabled: true, ready, reason: "Connect MetaMask to close the draw." };
  }
  if (input.chainId !== 11155111) {
    return { disabled: true, ready, reason: "Switch MetaMask to Sepolia to close the draw." };
  }

  return { disabled: false, ready };
}
