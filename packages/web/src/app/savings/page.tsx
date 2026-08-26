"use client";

import { useEffect, useMemo, useState } from "react";
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
import { decryptConfidentialBalances } from "@/lib/confidential-balances";
import { getZamaInstance } from "@/lib/zama";
import { useToast } from "@/components/Toast";
import { AmountInput } from "@/components/AmountInput";

type Status = "idle" | "working" | "success" | "error";
type WorkingAction = "decrypt" | "deposit" | "withdraw" | "pending" | undefined;

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
  return error instanceof Error ? error.message : String(error);
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

export default function SavingsPage() {
  const { session } = useWallet();
  const toast = useToast();
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [workingAction, setWorkingAction] = useState<WorkingAction>();
  const [usdcBalance, setUsdcBalance] = useState<bigint | undefined>();
  const [allowance, setAllowance] = useState<bigint | undefined>();
  const [confidentialBalance, setConfidentialBalance] = useState<bigint | undefined>();
  const [principal, setPrincipal] = useState<bigint | undefined>();
  const [pendingUnwraps, setPendingUnwraps] = useState<PendingUnwrap[]>([]);

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
    if (poolReady) void decryptConfidentialState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.address, poolReady]);

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
          args: [user, asAddress(addresses.confidentialUsdc, "Confidential USDC")],
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
      const token = asAddress(addresses.confidentialUsdc, "Confidential USDC");
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
    const token = asAddress(addresses.confidentialUsdc, "Confidential USDC");
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

    const token = asAddress(addresses.confidentialUsdc, "Confidential USDC");
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
    if (!wrapperReady) throw new Error("Confidential USDC address is not configured.");

    const token = asAddress(addresses.confidentialUsdc, "Confidential USDC");
    const zama = await getZamaInstance();
    const decrypted = await zama.publicDecrypt([requestId]);
    const clearValue = decrypted.clearValues[requestId];
    if (typeof clearValue !== "bigint") throw new Error("Unexpected public decrypt value.");
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
    if (!poolReady) throw new Error("Confidential prize pool address is not configured.");

    const usdc = asAddress(addresses.usdc, "USDC");
    const token = asAddress(addresses.confidentialUsdc, "Confidential USDC");
    const pool = asAddress(addresses.pool, "Confidential prize pool");
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
    await decryptConfidentialState(user);
  }

  async function withdrawConfidential() {
    const currentSession = activeSession();
    const user = currentSession.address;
    const value = parseUSDC(withdrawAmount);
    if (value === 0n) throw new Error("Valor invalido.");
    if (!poolReady) throw new Error("Confidential prize pool address is not configured.");

    const pool = asAddress(addresses.pool, "Confidential prize pool");
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
    setPrincipal(undefined);
  }

  async function decryptConfidentialState(currentUser?: `0x${string}`) {
    const currentSession = activeSession();
    const user = currentUser ?? currentSession.address;
    if (!poolReady) throw new Error("Confidential contracts are not configured.");

    const balances = await decryptConfidentialBalances(currentSession);
    if (balances.confidentialBalance !== undefined) {
      setConfidentialBalance(balances.confidentialBalance);
    }
    if (balances.principal !== undefined) {
      setPrincipal(balances.principal);
    }

    await refreshBalances(user);
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
          <span className="text-muted text-sm">Confidential balance</span>
          <span className="font-semibold tabular-nums">{formatUSDC(confidentialBalance)} cUSDC</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted text-sm">Deposited in pool</span>
          <span className="font-semibold tabular-nums text-brand">{formatUSDC(principal)} cUSDC</span>
        </div>
        <button
          className="btn-secondary w-full"
          disabled={!session || !poolReady || status === "working"}
          onClick={() => void run(decryptConfidentialState, "Confidential balances decrypted.", "decrypt")}
        >
          {workingAction === "decrypt" ? "Revealing..." : "Reveal balances"}
        </button>
      </div>

      <div className="card space-y-4">
        <AmountInput
          label="Deposit"
          maxLabel={`${formatUSDC(usdcBalance)} USDC`}
          value={depositAmount}
          onChange={setDepositAmount}
          onMax={() => setDepositAmount(usdcBalance !== undefined ? formatUSDC(usdcBalance, 6) : "0")}
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

      {showWithdraw && (
        <div className="card space-y-4">
          {hasWithdrawablePrincipal && (
            <AmountInput
              label="Withdraw"
              maxLabel={`${formatUSDC(principal)} cUSDC`}
              value={withdrawAmount}
              onChange={setWithdrawAmount}
              onMax={() => setWithdrawAmount(principal !== undefined ? formatUSDC(principal, 6) : "0")}
            />
          )}

          {hasWithdrawablePrincipal && (
            <button
              onClick={() =>
                void run(
                  withdrawConfidential,
                  "Encrypted withdrawal and USDC unwrap requested.",
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
                <div key={request.requestId} className="space-y-2 rounded-lg bg-surface2 p-3">
                  <p className="font-mono text-xs break-all text-muted">{request.requestId}</p>
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
        </div>
      )}

    </div>
  );
}
