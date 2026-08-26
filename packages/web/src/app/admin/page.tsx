"use client";

import { useEffect, useMemo, useState } from "react";
import { createPublicClient, encodeFunctionData, getAddress, http, isAddress, toHex } from "viem";
import { sepolia } from "viem/chains";
import { AmountInput } from "@/components/AmountInput";
import { useToast } from "@/components/Toast";
import {
  CONTRACTS,
  RPC_URL,
  confidentialPrizePoolAbi,
  confidentialUsdcAbi,
  erc20Abi,
} from "@/lib/contracts";
import { formatUSDC, parseUSDC } from "@/lib/format";
import { getZamaInstance } from "@/lib/zama";
import { useWallet } from "@/lib/wallet-context";
import { sendSmartTransaction, sendSmartTransactionBatch, type SmartSession } from "@/lib/web3auth";

type Status = "idle" | "working" | "success" | "error";
type WorkingAction = "fundPrize" | "closeDraw" | undefined;

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

export default function AdminPage() {
  const { session } = useWallet();
  const toast = useToast();
  const [status, setStatus] = useState<Status>("idle");
  const [workingAction, setWorkingAction] = useState<WorkingAction>();
  const [fundAmount, setFundAmount] = useState("");
  const [usdcBalance, setUsdcBalance] = useState<bigint | undefined>();
  const [allowance, setAllowance] = useState<bigint | undefined>();

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
  const ready = wrapperReady && isAddress(addresses.pool);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, session?.address]);

  function activeSession() {
    if (!session) throw new Error("Connect your smart account first.");
    return session;
  }

  async function sendTx(currentSession: SmartSession, to: `0x${string}`, data: `0x${string}`) {
    const tx = await sendSmartTransaction(currentSession, to, data);
    await publicClient.waitForTransactionReceipt({ hash: tx });
  }

  async function refresh() {
    if (!session?.address || !wrapperReady) return;

    const [balance, approved] = await Promise.all([
      publicClient.readContract({
        address: asAddress(addresses.usdc, "USDC"),
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [session.address],
      }),
      publicClient.readContract({
        address: asAddress(addresses.usdc, "USDC"),
        abi: erc20Abi,
        functionName: "allowance",
        args: [session.address, asAddress(addresses.confidentialUsdc, "Confidential USDC")],
      }),
    ]);
    setUsdcBalance(balance);
    setAllowance(approved);
  }

  async function fundPrize() {
    const currentSession = activeSession();
    const user = currentSession.address;
    const value = parseUSDC(fundAmount);
    if (value === 0n) throw new Error("Valor invalido.");
    if (!ready) throw new Error("Confidential contracts are not configured.");

    const usdc = asAddress(addresses.usdc, "USDC");
    const token = asAddress(addresses.confidentialUsdc, "Confidential USDC");
    const pool = asAddress(addresses.pool, "Confidential prize pool");
    const zama = await getZamaInstance();
    const prizeData = await publicClient.readContract({
      address: pool,
      abi: confidentialPrizePoolAbi,
      functionName: "PRIZE_FUNDING_DATA",
    });
    const encrypted = await zama.createEncryptedInput(token, user).add64(value).encrypt();
    const wrapCall = encodeFunctionData({
      abi: confidentialUsdcAbi,
      functionName: "wrap",
      args: [user, value],
    });
    const fundCall = encodeFunctionData({
      abi: confidentialUsdcAbi,
      functionName: "confidentialTransferAndCall",
      args: [pool, toHex(encrypted.handles[0]) as `0x${string}`, toHex(encrypted.inputProof), prizeData],
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
    calls.push({
      to: token,
      data: encodeFunctionData({
        abi: confidentialUsdcAbi,
        functionName: "multicall",
        args: [[wrapCall, fundCall]],
      }),
    });

    const tx = await sendSmartTransactionBatch(currentSession, calls);
    await publicClient.waitForTransactionReceipt({ hash: tx });
    setFundAmount("");
    await refresh();
  }

  async function closeDraw() {
    const currentSession = activeSession();
    if (!ready) throw new Error("Confidential contracts are not configured.");

    const data = encodeFunctionData({
      abi: confidentialPrizePoolAbi,
      functionName: "closeDraw",
      args: [],
    });
    await sendTx(currentSession, asAddress(addresses.pool, "Confidential prize pool"), data);
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
            Admin
          </span>
        </div>
        <h1 className="font-display text-3xl font-bold leading-tight">
          Controlo do pool.
          <br />
          Prémio e ronda.
        </h1>
        <p className="text-sm leading-relaxed text-muted">
          Ferramentas operacionais para financiar o prémio cifrado e acionar o
          fecho da ronda.
        </p>
      </section>

      <div className="card space-y-3">
        <div className="space-y-1">
          <p className="label">Patrocinar prémio</p>
          <p className="text-xs leading-relaxed text-muted">
            Adiciona USDC ao prémio cifrado da ronda ativa.
          </p>
        </div>
        <AmountInput
          label="Montante"
          maxLabel={`${formatUSDC(usdcBalance, 6)} USDC`}
          value={fundAmount}
          onChange={setFundAmount}
          onMax={() => setFundAmount(usdcBalance !== undefined ? formatUSDC(usdcBalance, 6) : "0")}
        />
        <button
          className="btn-primary w-full"
          disabled={!session || !ready || status === "working"}
          onClick={() => void run(fundPrize, "Prémio cifrado financiado.", "fundPrize")}
        >
          {workingAction === "fundPrize" ? "A financiar..." : "Financiar prémio"}
        </button>
      </div>

      <div className="card space-y-3">
        <div className="space-y-1">
          <p className="label">Keeper</p>
          <p className="text-xs leading-relaxed text-muted">
            Fecha a ronda quando o contador chega a zero e inicia a próxima.
          </p>
        </div>
        <button
          className="btn-secondary w-full"
          disabled={!session || !ready || status === "working"}
          onClick={() => void run(closeDraw, "Sorteio fechado com aleatoriedade cifrada.", "closeDraw")}
        >
          {workingAction === "closeDraw" ? "A fechar..." : "Fechar ronda"}
        </button>
      </div>
    </div>
  );
}
