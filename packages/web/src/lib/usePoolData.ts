"use client";

import { useReadContracts, useBlockNumber } from "wagmi";
import { useEffect, useState } from "react";
import { erc20Abi, formatEther } from "viem";
import { CONTRACTS, prizePoolAbi } from "./contracts";

export function useCurrentDraw() {
  return useReadContracts({
    contracts: [
      {
        address: CONTRACTS.prizePool,
        abi: prizePoolAbi,
        functionName: "currentDraw",
      },
      {
        address: CONTRACTS.prizePool,
        abi: prizePoolAbi,
        functionName: "drawInterval",
      },
    ],
    query: { refetchInterval: 30_000 },
  });
}

export function useDraw(drawId: bigint | undefined) {
  return useReadContracts({
    contracts: [
      {
        address: CONTRACTS.prizePool,
        abi: prizePoolAbi,
        functionName: "draws",
        args: drawId !== undefined ? [drawId] : undefined,
      },
    ],
    query: { enabled: drawId !== undefined, refetchInterval: 30_000 },
  });
}

export function useTickets(drawId: bigint | undefined, user: `0x${string}` | undefined) {
  return useReadContracts({
    contracts: [
      {
        address: CONTRACTS.prizePool,
        abi: prizePoolAbi,
        functionName: "getTickets",
        args:
          drawId !== undefined && user ? [drawId, user] : undefined,
      },
      {
        address: CONTRACTS.vault,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: user ? [user] : undefined,
      },
    ],
    query: {
      enabled: drawId !== undefined && Boolean(user),
      refetchInterval: 15_000,
    },
  });
}

export function useUSDCBalance(user: `0x${string}` | undefined) {
  return useReadContracts({
    contracts: [
      {
        address: CONTRACTS.usdc,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: user ? [user] : undefined,
      },
      {
        address: CONTRACTS.usdc,
        abi: erc20Abi,
        functionName: "allowance",
        args:
          user && CONTRACTS.prizePool
            ? [user, CONTRACTS.prizePool]
            : undefined,
      },
    ],
    query: { enabled: Boolean(user), refetchInterval: 15_000 },
  });
}

export function useCountdown(target: bigint | undefined) {
  const { data: blockNumber } = useBlockNumber({ watch: true });
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (target === undefined) return;
    const now = Math.floor(Date.now() / 1000);
    const t = Number(target);
    setSecondsLeft(Math.max(0, t - now));

    const id = setInterval(() => {
      const now2 = Math.floor(Date.now() / 1000);
      setSecondsLeft(Math.max(0, t - now2));
    }, 1000);

    return () => clearInterval(id);
  }, [target, blockNumber]);

  return secondsLeft;
}
