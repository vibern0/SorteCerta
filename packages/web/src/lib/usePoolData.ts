"use client";

import { useReadContracts, useBlockNumber } from "wagmi";
import { useEffect, useState } from "react";
import { erc20Abi } from "viem";
import { CONTRACTS, confidentialPrizePoolAbi } from "./contracts";

export function useCurrentDraw() {
  return useReadContracts({
    contracts: [
      {
        address: CONTRACTS.confidentialPrizePool,
        abi: confidentialPrizePoolAbi,
        functionName: "drawId",
      },
      {
        address: CONTRACTS.confidentialPrizePool,
        abi: confidentialPrizePoolAbi,
        functionName: "nextDrawAt",
      },
      {
        address: CONTRACTS.confidentialPrizePool,
        abi: confidentialPrizePoolAbi,
        functionName: "publicPrizeReserve",
      },
    ],
    query: { enabled: Boolean(CONTRACTS.confidentialPrizePool), refetchInterval: 30_000 },
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
          user && CONTRACTS.confidentialUsdc
            ? [user, CONTRACTS.confidentialUsdc]
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
