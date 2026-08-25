"use client";

import { useMemo, useState } from "react";
import { createPublicClient, encodeFunctionData, getAddress, http, isAddress, toHex } from "viem";
import { sepolia } from "viem/chains";
import {
  CHAIN_ID,
  CONTRACTS,
  RPC_URL,
  confidentialPrizePoolAbi,
  confidentialUsdcAbi,
  erc20Abi,
} from "@/lib/contracts";
import { formatUSDC, parseUSDC } from "@/lib/format";
import { getZamaInstance, stringifyTypedData, userDecryptTimestamp } from "@/lib/zama";

type Status = "idle" | "working" | "success" | "error";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}

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

export default function DrawPage() {
  const [account, setAccount] = useState<`0x${string}` | undefined>();
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("Connect an injected wallet to manage confidential draws.");
  const [fundAmount, setFundAmount] = useState("1");
  const [usdcBalance, setUsdcBalance] = useState<bigint | undefined>();
  const [allowance, setAllowance] = useState<bigint | undefined>();
  const [drawId, setDrawId] = useState<bigint | undefined>();
  const [participantCount, setParticipantCount] = useState<bigint | undefined>();
  const [winnings, setWinnings] = useState<bigint | undefined>();
  const [lastTx, setLastTx] = useState<string | undefined>();

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

  const ready = isAddress(addresses.usdc) && isAddress(addresses.confidentialUsdc) && isAddress(addresses.pool);

  async function connect() {
    if (!window.ethereum) throw new Error("Injected wallet not found.");

    const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as unknown[];
    const connected = asAddress(accounts[0], "User address");
    setAccount(connected);
    await refresh(connected);
    return connected;
  }

  async function activeAccount() {
    return account ?? connect();
  }

  async function ensureSepolia() {
    if (!window.ethereum) throw new Error("Injected wallet not found.");

    const expected = `0x${CHAIN_ID.toString(16)}`;
    const chainId = await window.ethereum.request({ method: "eth_chainId" });
    if (chainId !== expected) {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: expected }],
      });
    }
  }

  async function sendTx(to: `0x${string}`, data: `0x${string}`, from: `0x${string}`) {
    if (!window.ethereum) throw new Error("Injected wallet not found.");

    await ensureSepolia();
    const tx = (await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [{ from, to, data }],
    })) as `0x${string}`;
    setLastTx(tx);
    await publicClient.waitForTransactionReceipt({ hash: tx });
  }

  async function refresh(user = account) {
    if (!user || !ready) return;

    const usdc = asAddress(addresses.usdc, "USDC");
    const token = asAddress(addresses.confidentialUsdc, "Confidential USDC");
    const pool = asAddress(addresses.pool, "Confidential prize pool");
    const [balance, approved, currentDrawId, participants] = await Promise.all([
      publicClient.readContract({ address: usdc, abi: erc20Abi, functionName: "balanceOf", args: [user] }),
      publicClient.readContract({ address: usdc, abi: erc20Abi, functionName: "allowance", args: [user, token] }),
      publicClient.readContract({ address: pool, abi: confidentialPrizePoolAbi, functionName: "drawId" }),
      publicClient.readContract({ address: pool, abi: confidentialPrizePoolAbi, functionName: "participantCount" }),
    ]);

    setUsdcBalance(balance);
    setAllowance(approved);
    setDrawId(currentDrawId);
    setParticipantCount(participants);
  }

  async function approveIfNeeded(user: `0x${string}`, value: bigint) {
    if ((allowance ?? 0n) >= value) return;

    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [asAddress(addresses.confidentialUsdc, "Confidential USDC"), value],
    });
    await sendTx(asAddress(addresses.usdc, "USDC"), data, user);
  }

  async function fundPrize() {
    const user = await activeAccount();
    const value = parseUSDC(fundAmount);
    if (value === 0n) throw new Error("Invalid prize amount.");
    if (!ready) throw new Error("Confidential contracts are not configured.");

    await approveIfNeeded(user, value);
    const token = asAddress(addresses.confidentialUsdc, "Confidential USDC");
    const pool = asAddress(addresses.pool, "Confidential prize pool");
    const fundingData = await publicClient.readContract({
      address: pool,
      abi: confidentialPrizePoolAbi,
      functionName: "PRIZE_FUNDING_DATA",
    });
    const zama = await getZamaInstance();
    const encrypted = await zama.createEncryptedInput(token, user).add64(value).encrypt();
    const wrapCall = encodeFunctionData({
      abi: confidentialUsdcAbi,
      functionName: "wrap",
      args: [user, value],
    });
    const fundCall = encodeFunctionData({
      abi: confidentialUsdcAbi,
      functionName: "confidentialTransferAndCall",
      args: [pool, toHex(encrypted.handles[0]) as `0x${string}`, toHex(encrypted.inputProof), fundingData],
    });
    const data = encodeFunctionData({
      abi: confidentialUsdcAbi,
      functionName: "multicall",
      args: [[wrapCall, fundCall]],
    });

    await sendTx(token, data, user);
    setFundAmount("");
    await refresh(user);
  }

  async function closeDraw() {
    const user = await activeAccount();
    if (!ready) throw new Error("Confidential contracts are not configured.");

    const data = encodeFunctionData({
      abi: confidentialPrizePoolAbi,
      functionName: "closeDraw",
      args: [],
    });
    await sendTx(asAddress(addresses.pool, "Confidential prize pool"), data, user);
    await refresh(user);
  }

  async function decryptWinnings() {
    const user = await activeAccount();
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
    const signature = (await window.ethereum?.request({
      method: "eth_signTypedData_v4",
      params: [user, stringifyTypedData(eip712)],
    })) as string;
    const result = await zama.userDecrypt(
      [{ handle: handle as `0x${string}`, contractAddress: pool }],
      keypair.privateKey,
      keypair.publicKey,
      signature,
      [pool],
      user,
      startTimestamp,
      durationDays,
    );

    setWinnings(BigInt(String(result[handle as `0x${string}`])));
  }

  async function claimPrize() {
    const user = await activeAccount();
    if (!ready) throw new Error("Confidential contracts are not configured.");

    const data = encodeFunctionData({
      abi: confidentialPrizePoolAbi,
      functionName: "claimPrize",
      args: [],
    });
    await sendTx(asAddress(addresses.pool, "Confidential prize pool"), data, user);
    setWinnings(undefined);
    await refresh(user);
  }

  async function run(action: () => Promise<void>, ok: string) {
    setStatus("working");
    setMessage("Working...");
    setLastTx(undefined);
    try {
      await action();
      setStatus("success");
      setMessage(ok);
    } catch (error) {
      setStatus("error");
      setMessage(getErrorMessage(error));
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <h1 className="font-display text-2xl font-bold">Sorteio</h1>

      <div className="card space-y-3">
        <p className="label">Confidential draw</p>
        <p className="text-sm text-muted">Draw #{drawId === undefined ? "-" : drawId.toString()}</p>
        <p className="text-sm text-muted">Participants: {participantCount === undefined ? "-" : participantCount.toString()}</p>
        <p className="text-sm text-muted">USDC: {formatUSDC(usdcBalance)}</p>
        <button className="btn-secondary w-full" onClick={() => void run(async () => void (await connect()), "Wallet connected.")}>
          {account ?? "Connect injected wallet"}
        </button>
      </div>

      <div className="card space-y-3">
        <p className="label">Mock yield funding</p>
        <div className="flex gap-2">
          <input
            inputMode="decimal"
            value={fundAmount}
            onChange={(event) => setFundAmount(event.target.value)}
            className="input"
            placeholder="0"
          />
          <button
            className="btn-secondary whitespace-nowrap"
            disabled={!ready || status === "working"}
            onClick={() => void run(fundPrize, "Prize reserve funded.")}
          >
            Fund prize
          </button>
        </div>
      </div>

      <button
        className="btn-primary w-full"
        disabled={!ready || status === "working"}
        onClick={() => void run(closeDraw, "Draw closed with encrypted randomness.")}
      >
        {status === "working" ? "Working..." : "Close draw"}
      </button>

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-muted text-sm">My winnings</span>
          <span className="font-semibold tabular-nums text-brand">{formatUSDC(winnings)} cUSDC</span>
        </div>
        <button
          className="btn-secondary w-full"
          disabled={!ready || status === "working"}
          onClick={() => void run(decryptWinnings, "Winnings decrypted.")}
        >
          Decrypt winnings
        </button>
        <button
          className="btn-secondary w-full"
          disabled={!ready || status === "working"}
          onClick={() => void run(claimPrize, "Prize claimed to cUSDC balance.")}
        >
          Claim prize
        </button>
      </div>

      {lastTx && <p className="text-xs text-success break-all">Tx: {lastTx}</p>}
      <p className={`text-sm ${status === "error" ? "text-danger" : status === "success" ? "text-success" : "text-muted"}`}>
        {message}
      </p>
    </div>
  );
}
