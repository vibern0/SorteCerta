"use client";

import { useEffect, useMemo, useState } from "react";
import { createPublicClient, encodeFunctionData, getAddress, http, isAddress } from "viem";
import { sepolia } from "viem/chains";
import {
  CONTRACTS,
  RPC_URL,
  confidentialPrizePoolAbi,
} from "@/lib/contracts";
import { Countdown } from "@/components/Countdown";
import { formatUSDC } from "@/lib/format";
import { useWallet } from "@/lib/wallet-context";
import { sendSmartTransaction, signOwnerTypedData, type SmartSession } from "@/lib/web3auth";
import { getZamaInstance, userDecryptTimestamp } from "@/lib/zama";
import { useToast } from "@/components/Toast";

type Status = "idle" | "working" | "success" | "error";
type WorkingAction = "checkPrize" | "claimPrize" | undefined;

const ZERO_HANDLE = "0x0000000000000000000000000000000000000000000000000000000000000000";

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(RPC_URL),
});

function asAddress(value: unknown, label: string) {
  if (typeof value !== "string" || !isAddress(value)) throw new Error(`${label} is not a valid address.`);
  return getAddress(value);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isZeroHandle(handle: unknown) {
  return typeof handle === "string" && handle.toLowerCase() === ZERO_HANDLE;
}

function formatDateTime(timestamp: bigint | undefined) {
  if (timestamp === undefined) return "-";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(Number(timestamp) * 1000));
}

function formatInterval(seconds: bigint | undefined) {
  if (seconds === undefined) return "-";
  const value = Number(seconds);
  const unit = (amount: number, singular: string, plural: string) =>
    `${amount} ${amount === 1 ? singular : plural}`;

  if (value > 86_400) {
    const days = Math.floor(value / 86_400);
    const hours = Math.floor((value % 86_400) / 3_600);
    return hours > 0
      ? `${unit(days, "day", "days")} ${unit(hours, "hour", "hours")}`
      : unit(days, "day", "days");
  }

  if (value > 3_600) {
    const hours = Math.floor(value / 3_600);
    const minutes = Math.floor((value % 3_600) / 60);
    return minutes > 0
      ? `${unit(hours, "hour", "hours")} ${unit(minutes, "minute", "minutes")}`
      : unit(hours, "hour", "hours");
  }

  if (value > 60) return unit(Math.round(value / 60), "minute", "minutes");
  return unit(value, "second", "seconds");
}

export default function DrawPage() {
  const { session } = useWallet();
  const toast = useToast();
  const [status, setStatus] = useState<Status>("idle");
  const [workingAction, setWorkingAction] = useState<WorkingAction>();
  const [drawId, setDrawId] = useState<bigint | undefined>();
  const [drawInterval, setDrawInterval] = useState<bigint | undefined>();
  const [nextDrawAt, setNextDrawAt] = useState<bigint | undefined>();
  const [participantCount, setParticipantCount] = useState<bigint | undefined>();
  const [prizeReserveHandle, setPrizeReserveHandle] = useState<`0x${string}` | undefined>();
  const [winnings, setWinnings] = useState<bigint | undefined>();
  const addresses = useMemo(
    () => ({
      pool: isAddress(CONTRACTS.confidentialPrizePool)
        ? getAddress(CONTRACTS.confidentialPrizePool)
        : CONTRACTS.confidentialPrizePool,
    }),
    [],
  );

  const ready = isAddress(addresses.pool);
  const activeDrawId = drawId === undefined ? undefined : drawId + 1n;
  const roundsClosed = drawId ?? 0n;
  const hasPrizeReserveHandle = prizeReserveHandle !== undefined && !isZeroHandle(prizeReserveHandle);
  const canClaimPrize = winnings === undefined || winnings > 0n;

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    if (!session?.address) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.address]);

  function activeSession() {
    if (!session) throw new Error("Connect your smart account first.");
    return session;
  }

  async function sendTx(currentSession: SmartSession, to: `0x${string}`, data: `0x${string}`) {
    const tx = await sendSmartTransaction(currentSession, to, data);
    await publicClient.waitForTransactionReceipt({ hash: tx });
  }

  async function refresh() {
    if (!ready) return;

    const pool = asAddress(addresses.pool, "Confidential prize pool");
    const [currentDrawId, interval, nextAt, participants, reserveHandle] = await Promise.all([
      publicClient.readContract({ address: pool, abi: confidentialPrizePoolAbi, functionName: "drawId" }),
      publicClient.readContract({ address: pool, abi: confidentialPrizePoolAbi, functionName: "drawInterval" }),
      publicClient.readContract({ address: pool, abi: confidentialPrizePoolAbi, functionName: "nextDrawAt" }),
      publicClient.readContract({ address: pool, abi: confidentialPrizePoolAbi, functionName: "participantCount" }),
      publicClient.readContract({ address: pool, abi: confidentialPrizePoolAbi, functionName: "encryptedPrizeReserve" }),
    ]);

    setDrawId(currentDrawId);
    setDrawInterval(interval);
    setNextDrawAt(nextAt);
    setParticipantCount(participants);
    setPrizeReserveHandle(reserveHandle as `0x${string}`);
  }

  async function decryptWinnings() {
    const currentSession = activeSession();
    const user = currentSession.address;
    if (!ready) throw new Error("Confidential contracts are not configured.");

    const pool = asAddress(addresses.pool, "Confidential prize pool");
    const handle = await publicClient.readContract({
      address: pool,
      abi: confidentialPrizePoolAbi,
      functionName: "encryptedWinningsOf",
      args: [user],
    });

    if (isZeroHandle(handle)) {
      setWinnings(0n);
      return;
    }

    const zama = await getZamaInstance();
    const keypair = zama.generateKeypair();
    const startTimestamp = userDecryptTimestamp();
    const durationDays = 365;
    const eip712 = zama.createEIP712(keypair.publicKey, [pool], startTimestamp, durationDays);
    const signature = await signOwnerTypedData(currentSession, eip712);
    const result = await zama.userDecrypt(
      [{ handle: handle as `0x${string}`, contractAddress: pool }],
      keypair.privateKey,
      keypair.publicKey,
      signature,
      [pool],
      currentSession.ownerAddress,
      startTimestamp,
      durationDays,
    );

    setWinnings(BigInt(String(result[handle as `0x${string}`])));
  }

  async function claimPrize() {
    const currentSession = activeSession();
    if (!ready) throw new Error("Confidential contracts are not configured.");

    const data = encodeFunctionData({
      abi: confidentialPrizePoolAbi,
      functionName: "claimPrize",
      args: [],
    });
    await sendTx(currentSession, asAddress(addresses.pool, "Confidential prize pool"), data);
    setWinnings(undefined);
    await refresh();
  }

  async function run(action: () => Promise<void>, ok: string, currentAction?: WorkingAction) {
    setStatus("working");
    setWorkingAction(currentAction);
    try {
      await action();
      setStatus("success");
      toast({ tone: "success", title: ok });
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setStatus("error");
      toast({ tone: "error", title: "Transaction failed", description: errorMessage });
    } finally {
      setWorkingAction(undefined);
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <section className="space-y-3">
        <div className="inline-flex">
          <span className="pill">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            Confidential draw
          </span>
        </div>
        <h1 className="font-display text-3xl font-bold leading-tight">
          Global state.
          <br />
          Prizes and rounds.
        </h1>
        <p className="text-sm leading-relaxed text-muted">
          See the pool's public cadence, how many accounts are participating,
          and claim your prize when one exists.
        </p>
      </section>

      <div className="card space-y-3">
        <p className="label">Next draw</p>
        <Countdown target={nextDrawAt} />
        <div className="grid gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted">Public schedule</span>
            <span className="font-semibold text-right">{formatDateTime(nextDrawAt)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted">Recurrence</span>
            <span className="font-semibold">{formatInterval(drawInterval)}</span>
          </div>
        </div>
      </div>

      <div className="card space-y-3">
        <p className="label">Global pool</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/35 border border-white/50 p-3 min-h-24">
            <p className="text-xs text-muted">Active round</p>
            <p className="font-display text-2xl font-bold tabular-nums">
              #{activeDrawId === undefined ? "-" : activeDrawId.toString()}
            </p>
          </div>
          <div className="rounded-2xl bg-white/35 border border-white/50 p-3 min-h-24">
            <p className="text-xs text-muted">Participants</p>
            <p className="font-display text-2xl font-bold tabular-nums">
              {participantCount === undefined ? "-" : participantCount.toString()}
            </p>
          </div>
          <div className="rounded-2xl bg-white/35 border border-white/50 p-3 min-h-24">
            <p className="text-xs text-muted">Closed rounds</p>
            <p className="font-display text-2xl font-bold tabular-nums">
              {roundsClosed.toString()}
            </p>
          </div>
          <div className="rounded-2xl bg-white/35 border border-white/50 p-3 min-h-24">
            <p className="text-xs text-muted">Prize</p>
            <p className="font-display text-xl font-bold tabular-nums">
              {hasPrizeReserveHandle ? "Encrypted" : "-"}
            </p>
          </div>
        </div>
        {hasPrizeReserveHandle && (
          <p className="rounded-2xl bg-white/30 border border-white/45 px-3 py-2 text-xs leading-relaxed text-muted">
            The prize amount stays encrypted in the contract until the round closes.
          </p>
        )}
      </div>

      <div className="card space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="label">My winnings</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Winnings stay encrypted. Only your account can reveal and claim them.
            </p>
          </div>
          <span className="font-display text-xl font-bold tabular-nums text-brand whitespace-nowrap">
            {formatUSDC(winnings)} cUSDC
          </span>
        </div>
        <button
          className="btn-secondary w-full"
          disabled={!session || !ready || status === "working"}
          onClick={() => void run(decryptWinnings, "Winnings revealed.", "checkPrize")}
        >
          {workingAction === "checkPrize" ? "Checking..." : "Check prize"}
        </button>
        <button
          className="btn-primary w-full"
          disabled={!session || !ready || status === "working" || !canClaimPrize}
          onClick={() => void run(claimPrize, "Prize claimed to your cUSDC balance.", "claimPrize")}
        >
          {workingAction === "claimPrize" ? "Claiming..." : "Claim prize"}
        </button>
      </div>

    </div>
  );
}
