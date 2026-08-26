"use client";

import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { createPublicClient, encodeAbiParameters, encodeEventTopics, encodeFunctionData, getAddress, http, isAddress, parseEventLogs, toHex } from "viem";
import { sepolia } from "viem/chains";
import {
  CONTRACTS,
  RPC_URL,
  confidentialPrizePoolAbi,
  confidentialUsdcAbi,
  erc20Abi,
} from "@/lib/contracts";
import { formatUSDC, parseUSDC } from "@/lib/format";
import { useWallet } from "@/lib/wallet-context";
import { sendSmartTransaction, sendSmartTransactionBatch, type SmartSession } from "@/lib/web3auth";
import { getZamaInstance } from "@/lib/zama";
import { useToast } from "@/components/Toast";
import { AmountInput } from "@/components/AmountInput";
import { LoadingAmount } from "@/components/LoadingAmount";

type Status = "idle" | "working" | "success" | "error";
type WorkingAction = "deposit" | "withdraw" | "pending" | undefined;

const PENDING_UNWRAPS_STORAGE_PREFIX = "sortecerta:pending-unwraps";
const UNWRAP_LOG_LOOKBACK_BLOCKS = 512n;

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(RPC_URL),
});

function asAddress(value: unknown, label: string) {
  if (typeof value !== "string" || !isAddress(value)) {
    throw new Error(`${label} is not a valid address.`);
  }

  return getAddress(value);
}

function getErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /encrypted|confidential|public|private|mock|testnet|sepolia|prototype|faucet|leakage|decrypted/i.test(message)
    ? "Something went wrong. Please try again."
    : message;
}

type PendingUnwrap = {
  requestId: `0x${string}`;
  txHash: `0x${string}`;
};

function isHexString(value: unknown): value is `0x${string}` {
  return typeof value === "string" && value.startsWith("0x");
}

function pendingUnwrapStorageKey(token: `0x${string}`, user: `0x${string}`) {
  return `${PENDING_UNWRAPS_STORAGE_PREFIX}:${token}:${user}`;
}

function readStoredPendingUnwraps(token: `0x${string}`, user: `0x${string}`) {
  if (typeof window === "undefined") return [];

  try {
    const stored = JSON.parse(window.localStorage.getItem(pendingUnwrapStorageKey(token, user)) ?? "[]");
    if (!Array.isArray(stored)) return [];

    return stored.filter(
      (request): request is PendingUnwrap => isHexString(request?.requestId) && isHexString(request?.txHash),
    );
  } catch {
    return [];
  }
}

function writeStoredPendingUnwraps(token: `0x${string}`, user: `0x${string}`, requests: PendingUnwrap[]) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(pendingUnwrapStorageKey(token, user), JSON.stringify(requests));
}

function formatShortHash(hash: `0x${string}`) {
  return hash.replace(/^0x/, "").slice(0, 6);
}

export default function SavingsPage() {
  const {
    session,
    confidentialBalance,
    principal,
    confidentialBalancesLoading,
    confidentialBalancesError,
    refreshConfidentialBalances,
  } = useWallet();
  const toast = useToast();
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [workingAction, setWorkingAction] = useState<WorkingAction>();
  const [usdcBalance, setUsdcBalance] = useState<bigint | undefined>();
  const [allowance, setAllowance] = useState<bigint | undefined>();
  const [pendingUnwraps, setPendingUnwraps] = useState<PendingUnwrap[]>([]);
  const [depositSheetOpen, setDepositSheetOpen] = useState(false);
  const [withdrawSheetOpen, setWithdrawSheetOpen] = useState(false);

  const addresses = useMemo(
    () => ({
      usdc: isAddress(CONTRACTS.usdc) ? getAddress(CONTRACTS.usdc) : CONTRACTS.usdc,
      confidentialUsdc: isAddress(CONTRACTS.confidentialUsdc)
        ? getAddress(CONTRACTS.confidentialUsdc)
        : CONTRACTS.confidentialUsdc,
      pool: isAddress(CONTRACTS.confidentialPrizePool)
        ? getAddress(CONTRACTS.confidentialPrizePool)
        : CONTRACTS.confidentialPrizePool,
    }),
    [],
  );

  const usdcReady = isAddress(addresses.usdc);
  const wrapperReady = usdcReady && isAddress(addresses.confidentialUsdc);
  const poolReady = wrapperReady && isAddress(addresses.pool);
  const hasWithdrawablePrincipal = principal !== undefined && principal > 0n;
  const showWithdraw = hasWithdrawablePrincipal || pendingUnwraps.length > 0;

  useEffect(() => {
    if (!session?.address) return;
    void refreshBalances(session.address);
    void refreshPendingUnwraps(session.address);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.address, poolReady]);

  const sheetOpen = depositSheetOpen || withdrawSheetOpen;

  useEffect(() => {
    if (!sheetOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDepositSheetOpen(false);
        setWithdrawSheetOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [sheetOpen]);

  function activeSession() {
    if (!session) throw new Error("Connect your smart account first.");
    return session;
  }

  async function refreshBalances(user = session?.address) {
    if (!user || !usdcReady) return;

    const balance = await publicClient.readContract({
      address: asAddress(addresses.usdc, "USDC"),
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [user],
    });

    const approved = wrapperReady
      ? await publicClient.readContract({
          address: asAddress(addresses.usdc, "USDC"),
          abi: erc20Abi,
          functionName: "allowance",
          args: [user, asAddress(addresses.confidentialUsdc, "Savings token")],
        })
      : undefined;

    setUsdcBalance(balance);
    setAllowance(approved);
  }

  async function sendTx(currentSession: SmartSession, to: `0x${string}`, data: `0x${string}`) {
    const tx = await sendSmartTransaction(currentSession, to, data);
    return publicClient.waitForTransactionReceipt({ hash: tx });
  }

  function rememberUnwrapRequest(
    receipt: Awaited<ReturnType<typeof publicClient.waitForTransactionReceipt>>,
    user: `0x${string}`,
  ) {
    const events = parseEventLogs({
      abi: confidentialUsdcAbi,
      eventName: "UnwrapRequested",
      logs: receipt.logs,
    });
    const requestId = events.at(-1)?.args.unwrapRequestId;
    if (requestId) {
        const token = asAddress(addresses.confidentialUsdc, "Savings token");
      setPendingUnwraps((current) => {
        const next = [{ requestId, txHash: receipt.transactionHash }, ...current.filter((request) => request.requestId !== requestId)];
        writeStoredPendingUnwraps(token, user, next);
        return next;
      });
    }
  }

  async function getUnwrapLogs(
    eventName: "UnwrapRequested" | "UnwrapFinalized",
    receiver: `0x${string}`,
    fromBlock: bigint,
    toBlock: bigint,
  ) {
      const token = asAddress(addresses.confidentialUsdc, "Savings token");
    const chunkSize = 1_000n;
    const logs = [];

    for (let start = fromBlock; start <= toBlock; start += chunkSize + 1n) {
      const end = start + chunkSize > toBlock ? toBlock : start + chunkSize;
      const topics = encodeEventTopics({
        abi: confidentialUsdcAbi,
        eventName,
        args: { receiver },
      });
      const chunk = await publicClient.request({
        method: "eth_getLogs",
        params: [
          {
            address: token,
            topics,
            fromBlock: toHex(start),
            toBlock: toHex(end),
          },
        ],
      });
      logs.push(...chunk);
    }

    return logs;
  }

  async function refreshPendingUnwraps(user = session?.address) {
    if (!user || !wrapperReady) return;

    const token = asAddress(addresses.confidentialUsdc, "Savings token");
    const stored = readStoredPendingUnwraps(token, user);
    const latestBlock = await publicClient.getBlockNumber();
    const fromBlock = latestBlock > UNWRAP_LOG_LOOKBACK_BLOCKS ? latestBlock - UNWRAP_LOG_LOOKBACK_BLOCKS : 0n;
    let discovered: PendingUnwrap[] = [];

    try {
      const [requestedLogs, finalizedLogs] = await Promise.all([
        getUnwrapLogs("UnwrapRequested", user, fromBlock, latestBlock),
        getUnwrapLogs("UnwrapFinalized", user, fromBlock, latestBlock),
      ]);
      const requested = parseEventLogs({
        abi: confidentialUsdcAbi,
        eventName: "UnwrapRequested",
        logs: requestedLogs,
      });
      const finalized = parseEventLogs({
        abi: confidentialUsdcAbi,
        eventName: "UnwrapFinalized",
        logs: finalizedLogs,
      });
      const finalizedIds = new Set(finalized.map((event) => event.args.unwrapRequestId?.toLowerCase()));

      discovered = requested
        .map((event) => {
          const requestId = event.args.unwrapRequestId;
          if (!requestId || finalizedIds.has(requestId.toLowerCase())) return undefined;
          return { requestId, txHash: event.transactionHash };
        })
        .filter((request): request is PendingUnwrap => request !== undefined);
    } catch {
      discovered = [];
    }

    const byId = new Map<string, PendingUnwrap>();
    for (const request of [...stored, ...discovered]) {
      byId.set(request.requestId.toLowerCase(), request);
    }

    const pending = (
      await Promise.all(
        Array.from(byId.values()).map(async (request) => {
          try {
            const requester = await publicClient.readContract({
              address: token,
              abi: confidentialUsdcAbi,
              functionName: "unwrapRequester",
              args: [request.requestId],
            });
            if (requester.toLowerCase() !== user.toLowerCase()) return undefined;
            return request;
          } catch {
            return request;
          }
        }),
      )
    ).filter((request): request is PendingUnwrap => request !== undefined);

    const next = pending.reverse();
    setPendingUnwraps(next);
    writeStoredPendingUnwraps(token, user, next);
  }

  async function finalizeUnwrap(requestId: `0x${string}`) {
    const currentSession = activeSession();
    const user = currentSession.address;
    if (!wrapperReady) throw new Error("Withdrawals are unavailable right now.");

    const token = asAddress(addresses.confidentialUsdc, "Savings token");
    const zama = await getZamaInstance();
    const decrypted = await zama.publicDecrypt([requestId]);
    const clearValue = decrypted.clearValues[requestId];
    if (typeof clearValue !== "bigint") throw new Error("Withdrawal is not ready yet.");
    const data = encodeFunctionData({
      abi: confidentialUsdcAbi,
      functionName: "finalizeUnwrap",
      args: [requestId, clearValue, decrypted.decryptionProof],
    });
    await sendTx(currentSession, token, data);
    await refreshBalances(user);
    await refreshPendingUnwraps(user);
  }

  async function depositConfidential() {
    const currentSession = activeSession();
    const user = currentSession.address;
    const value = parseUSDC(depositAmount);
    if (value === 0n) throw new Error("Valor invalido.");
    if (!poolReady) throw new Error("Deposits are unavailable right now.");

    const usdc = asAddress(addresses.usdc, "USDC");
    const token = asAddress(addresses.confidentialUsdc, "Savings token");
    const pool = asAddress(addresses.pool, "Prize pool");
    const zama = await getZamaInstance();
    const encrypted = await zama.createEncryptedInput(token, user).add64(value).encrypt();
    const wrapCall = encodeFunctionData({
      abi: confidentialUsdcAbi,
      functionName: "wrap",
      args: [user, value],
    });
    const depositCall = encodeFunctionData({
      abi: confidentialUsdcAbi,
      functionName: "confidentialTransferAndCall",
      args: [
        pool,
        toHex(encrypted.handles[0]) as `0x${string}`,
        toHex(encrypted.inputProof),
        encodeAbiParameters([{ type: "address" }], [currentSession.ownerAddress]),
      ],
    });
    const data = encodeFunctionData({
      abi: confidentialUsdcAbi,
      functionName: "multicall",
      args: [[wrapCall, depositCall]],
    });
    const calls = [];
    if ((allowance ?? 0n) < value) {
      calls.push({
        to: usdc,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [token, value],
        }),
      });
    }
    calls.push({ to: token, data });

    const tx = await sendSmartTransactionBatch(currentSession, calls);
    await publicClient.waitForTransactionReceipt({ hash: tx });
    setDepositAmount("");
    setDepositSheetOpen(false);
    await refreshConfidentialBalances();
    await refreshBalances(user);
  }

  async function withdrawConfidential() {
    const currentSession = activeSession();
    const user = currentSession.address;
    const value = parseUSDC(withdrawAmount);
    if (value === 0n) throw new Error("Valor invalido.");
    if (!poolReady) throw new Error("Withdrawals are unavailable right now.");

    const pool = asAddress(addresses.pool, "Prize pool");
    const zama = await getZamaInstance();
    const encrypted = await zama.createEncryptedInput(pool, user).add64(value).encrypt();
    const data = encodeFunctionData({
      abi: confidentialPrizePoolAbi,
      functionName: "withdrawToUsdc",
      args: [toHex(encrypted.handles[0]) as `0x${string}`, toHex(encrypted.inputProof), user],
    });
    const receipt = await sendTx(currentSession, pool, data);
    rememberUnwrapRequest(receipt, user);
    await refreshBalances(user);
    setWithdrawAmount("");
    await refreshConfidentialBalances();
  }

  function closeSheets() {
    setDepositSheetOpen(false);
    setWithdrawSheetOpen(false);
  }

  async function run(action: () => Promise<void>, ok: string, currentAction?: WorkingAction) {
    flushSync(() => {
      setStatus("working");
      setWorkingAction(currentAction);
    });
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
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

  async function copyPendingHash(hash: `0x${string}`) {
    await navigator.clipboard.writeText(hash);
    toast({ tone: "success", title: "Withdrawal ID copied." });
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <section className="space-y-2">
        <h1 className="font-display text-2xl font-bold">My savings</h1>
        <p className="text-sm leading-relaxed text-muted">
          Wallet balance, deposited principal, and money moving in or out.
        </p>
      </section>

      <div className="card space-y-3">
        <p className="label">Personal status</p>
        <div className="flex items-center justify-between">
          <span className="text-muted text-sm">In wallet</span>
          <span className="font-semibold tabular-nums">{formatUSDC(usdcBalance)} USDC</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted text-sm">Savings balance</span>
          <span className="font-semibold tabular-nums">
            {confidentialBalancesLoading ? <LoadingAmount /> : `${formatUSDC(confidentialBalance)} cUSDC`}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted text-sm">Deposited in pool</span>
          <span className="font-semibold tabular-nums text-brand">
            {confidentialBalancesLoading ? <LoadingAmount /> : `${formatUSDC(principal)} cUSDC`}
          </span>
        </div>
        {confidentialBalancesError && <p className="text-xs text-danger">{confidentialBalancesError}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setDepositSheetOpen(true)}
          disabled={!session || !poolReady || status === "working"}
          className="btn-primary w-full"
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          >
            <path d="M12 3v12" />
            <path d="m7 10 5 5 5-5" />
            <path d="M5 21h14" />
          </svg>
          Deposit
        </button>

        <button
          type="button"
          onClick={() => setWithdrawSheetOpen(true)}
          disabled={!showWithdraw || status === "working"}
          className="btn-secondary w-full"
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          >
            <path d="M12 21V9" />
            <path d="m7 14 5-5 5 5" />
            <path d="M5 3h14" />
          </svg>
          Withdraw
        </button>
      </div>

      {depositSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-text/35 px-4 pb-4 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Close deposit sheet"
            className="absolute inset-0 h-full w-full cursor-default"
            onClick={closeSheets}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="deposit-sheet-title"
            className="glass-surface relative max-h-[86vh] w-full max-w-[448px] space-y-4 overflow-y-auto rounded-t-[30px] p-5 shadow-[0_-28px_64px_-38px_rgb(43_45_50_/_0.55)] animate-fade-in"
          >
            <div className="mx-auto h-1.5 w-12 rounded-full bg-text/20" />
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="label">Deposit</p>
                <h2 id="deposit-sheet-title" className="font-display text-xl font-bold">
                  Move USDC into the pool
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close deposit sheet"
                onClick={closeSheets}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/40 text-muted transition-colors hover:bg-white/60 hover:text-text"
              >
                <svg
                  aria-hidden="true"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <AmountInput
              label="Amount"
              maxLabel={`${formatUSDC(usdcBalance)} USDC`}
              value={depositAmount}
              onChange={setDepositAmount}
              onMax={() => setDepositAmount(usdcBalance !== undefined ? formatUSDC(usdcBalance, 6) : "0")}
              disabled={workingAction === "deposit"}
            />

            <button
              onClick={() =>
                void run(
                  depositConfidential,
                  `Your ${depositAmount || "0"} USDC deposit is confirmed.`,
                  "deposit",
                )
              }
              disabled={!session || !poolReady || status === "working"}
              className="btn-primary w-full"
            >
              {workingAction === "deposit" ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Sending...
                </>
              ) : (
                "Deposit USDC"
              )}
            </button>
          </div>
        </div>
      )}

      {withdrawSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-text/35 px-4 pb-4 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Close withdrawal sheet"
            className="absolute inset-0 h-full w-full cursor-default"
            onClick={closeSheets}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="withdraw-sheet-title"
            className="glass-surface relative max-h-[86vh] w-full max-w-[448px] space-y-4 overflow-y-auto rounded-t-[30px] p-5 shadow-[0_-28px_64px_-38px_rgb(43_45_50_/_0.55)] animate-fade-in"
          >
            <div className="mx-auto h-1.5 w-12 rounded-full bg-text/20" />
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="label">Withdraw</p>
                <h2 id="withdraw-sheet-title" className="font-display text-xl font-bold">
                  Move pool funds to USDC
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close withdrawal sheet"
                onClick={closeSheets}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/40 text-muted transition-colors hover:bg-white/60 hover:text-text"
              >
                <svg
                  aria-hidden="true"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            {hasWithdrawablePrincipal && (
              <AmountInput
                label="Amount"
                maxLabel={`${formatUSDC(principal)} cUSDC`}
                value={withdrawAmount}
                onChange={setWithdrawAmount}
                onMax={() => setWithdrawAmount(principal !== undefined ? formatUSDC(principal, 6) : "0")}
                disabled={workingAction === "withdraw"}
              />
            )}

            {hasWithdrawablePrincipal && (
              <button
                onClick={() =>
                  void run(
                    withdrawConfidential,
                    "Withdrawal requested.",
                    "withdraw",
                  )
                }
                disabled={!session || !poolReady || status === "working"}
                className="btn-secondary w-full"
              >
                {workingAction === "withdraw" ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-text/20 border-t-text animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Withdraw to USDC"
                )}
              </button>
            )}

            {pendingUnwraps.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted text-sm">Pending withdrawal</span>
                  <button
                    className="btn-ghost !py-1 !px-3 !text-xs bg-surface2"
                    disabled={!session || !wrapperReady || status === "working"}
                    onClick={() =>
                      void run(async () => void (await refreshPendingUnwraps()), "Pending withdraws refreshed.", "pending")
                    }
                  >
                    {workingAction === "pending" ? "Refreshing..." : "Refresh"}
                  </button>
                </div>
                {pendingUnwraps.map((request) => (
                  <div key={request.requestId} className="space-y-2">
                    <button
                      type="button"
                      className="font-mono text-xs text-muted underline-offset-2 transition-colors hover:text-text hover:underline"
                      title="Copy withdrawal ID"
                      onClick={() => void copyPendingHash(request.requestId)}
                    >
                      {formatShortHash(request.requestId)}
                    </button>
                    <button
                      className="btn-secondary w-full"
                      disabled={status === "working"}
                      onClick={() =>
                        void run(
                          () => finalizeUnwrap(request.requestId),
                          "Your USDC withdrawal is finalized.",
                          "pending",
                        )
                      }
                    >
                      {workingAction === "pending" ? "Finalizing..." : "Finalize withdrawal"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {!showWithdraw && <p className="text-sm text-muted">No deposited funds or pending withdrawals yet.</p>}
          </div>
        </div>
      )}

    </div>
  );
}
