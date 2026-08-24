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

type Mode = "wrap" | "deposit" | "withdraw";
type Status = "idle" | "working" | "success" | "error";

const QUICK_AMOUNTS = ["10", "25", "50", "100"];

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}

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

export default function SavingsPage() {
  const [account, setAccount] = useState<`0x${string}` | undefined>();
  const [mode, setMode] = useState<Mode>("wrap");
  const [amount, setAmount] = useState("25");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("Connect an injected wallet to use confidential savings.");
  const [usdcBalance, setUsdcBalance] = useState<bigint | undefined>();
  const [allowance, setAllowance] = useState<bigint | undefined>();
  const [confidentialBalance, setConfidentialBalance] = useState<string | undefined>();
  const [principal, setPrincipal] = useState<string | undefined>();
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
    await refreshBalances(connected);

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

  async function refreshBalances(user = account) {
    if (!user || !ready) return;

    const [balance, approved] = await Promise.all([
      publicClient.readContract({
        address: asAddress(addresses.usdc, "USDC"),
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [user],
      }),
      publicClient.readContract({
        address: asAddress(addresses.usdc, "USDC"),
        abi: erc20Abi,
        functionName: "allowance",
        args: [user, asAddress(addresses.confidentialUsdc, "Confidential USDC")],
      }),
    ]);

    setUsdcBalance(balance);
    setAllowance(approved);
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

  async function approveIfNeeded(user: `0x${string}`, value: bigint) {
    if ((allowance ?? 0n) >= value) return;

    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [asAddress(addresses.confidentialUsdc, "Confidential USDC"), value],
    });
    await sendTx(asAddress(addresses.usdc, "USDC"), data, user);
  }

  async function wrapUsdc() {
    const user = await activeAccount();
    const value = parseUSDC(amount);
    if (value === 0n) throw new Error("Valor invalido.");

    await approveIfNeeded(user, value);
    const data = encodeFunctionData({
      abi: confidentialUsdcAbi,
      functionName: "wrap",
      args: [user, value],
    });
    await sendTx(asAddress(addresses.confidentialUsdc, "Confidential USDC"), data, user);
    await refreshBalances(user);
  }

  async function depositConfidential() {
    const user = await activeAccount();
    const value = parseUSDC(amount);
    if (value === 0n) throw new Error("Valor invalido.");

    const token = asAddress(addresses.confidentialUsdc, "Confidential USDC");
    const pool = asAddress(addresses.pool, "Confidential prize pool");
    const zama = await getZamaInstance();
    const encrypted = await zama.createEncryptedInput(token, user).add64(value).encrypt();
    const data = encodeFunctionData({
      abi: confidentialUsdcAbi,
      functionName: "confidentialTransferAndCall",
      args: [pool, toHex(encrypted.handles[0]) as `0x${string}`, toHex(encrypted.inputProof), "0x"],
    });
    await sendTx(token, data, user);
    await refreshBalances(user);
  }

  async function withdrawConfidential() {
    const user = await activeAccount();
    const value = parseUSDC(amount);
    if (value === 0n) throw new Error("Valor invalido.");

    const pool = asAddress(addresses.pool, "Confidential prize pool");
    const zama = await getZamaInstance();
    const encrypted = await zama.createEncryptedInput(pool, user).add64(value).encrypt();
    const data = encodeFunctionData({
      abi: confidentialPrizePoolAbi,
      functionName: "withdraw",
      args: [toHex(encrypted.handles[0]) as `0x${string}`, toHex(encrypted.inputProof)],
    });
    await sendTx(pool, data, user);
    await refreshBalances(user);
  }

  async function decryptHandle(handle: `0x${string}`, contract: `0x${string}`, user: `0x${string}`) {
    if (!window.ethereum) throw new Error("Injected wallet not found.");

    const zama = await getZamaInstance();
    const keypair = zama.generateKeypair();
    const startTimestamp = userDecryptTimestamp();
    const durationDays = 365;
    const eip712 = zama.createEIP712(keypair.publicKey, [contract], startTimestamp, durationDays);
    const signature = (await window.ethereum.request({
      method: "eth_signTypedData_v4",
      params: [user, stringifyTypedData(eip712)],
    })) as string;

    const results = await zama.userDecrypt(
      [{ handle, contractAddress: contract }],
      keypair.privateKey,
      keypair.publicKey,
      signature,
      [contract],
      user,
      startTimestamp,
      durationDays,
    );

    return results[handle];
  }

  async function decryptConfidentialState() {
    const user = await activeAccount();
    const token = asAddress(addresses.confidentialUsdc, "Confidential USDC");
    const pool = asAddress(addresses.pool, "Confidential prize pool");

    const [balanceHandle, principalHandle] = await Promise.all([
      publicClient.readContract({
        address: token,
        abi: confidentialUsdcAbi,
        functionName: "confidentialBalanceOf",
        args: [user],
      }),
      publicClient.readContract({
        address: pool,
        abi: confidentialPrizePoolAbi,
        functionName: "encryptedPrincipalOf",
        args: [user],
      }),
    ]);

    const balanceValue = await decryptHandle(balanceHandle as `0x${string}`, token, user);
    const principalValue = await decryptHandle(principalHandle as `0x${string}`, pool, user);

    setConfidentialBalance(formatUSDC(BigInt(String(balanceValue))));
    setPrincipal(formatUSDC(BigInt(String(principalValue))));
    await refreshBalances(user);
  }

  async function submit() {
    if (mode === "wrap") await wrapUsdc();
    if (mode === "deposit") await depositConfidential();
    if (mode === "withdraw") await withdrawConfidential();
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
      <h1 className="font-display text-2xl font-bold">Poupar</h1>

      <div className="card space-y-3">
        <p className="label">Confidential contracts</p>
        <p className="font-mono text-xs break-all text-muted">USDC: {ready ? addresses.usdc : "missing"}</p>
        <p className="font-mono text-xs break-all text-muted">
          cUSDC: {ready ? addresses.confidentialUsdc : "missing"}
        </p>
        <p className="font-mono text-xs break-all text-muted">Pool: {ready ? addresses.pool : "missing"}</p>
        <button className="btn-secondary w-full" onClick={() => void run(async () => void (await connect()), "Wallet connected.")}>
          {account ? account : "Connect injected wallet"}
        </button>
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-muted text-sm">USDC</span>
          <span className="font-semibold tabular-nums">{formatUSDC(usdcBalance)} USDC</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted text-sm">cUSDC decryptado</span>
          <span className="font-semibold tabular-nums">{confidentialBalance ?? "-"} cUSDC</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted text-sm">Principal no pool</span>
          <span className="font-semibold tabular-nums text-brand">{principal ?? "-"} cUSDC</span>
        </div>
        <button
          className="btn-secondary w-full"
          disabled={!ready || status === "working"}
          onClick={() => void run(decryptConfidentialState, "Confidential balances decrypted.")}
        >
          Decrypt balances
        </button>
      </div>

      <div className="flex gap-1 bg-surface2 p-1 rounded-xl">
        {(["wrap", "deposit", "withdraw"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`font-display flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
              mode === m ? "bg-bg text-text" : "text-muted hover:text-text"
            }`}
          >
            {m === "wrap" ? "Wrap" : m === "deposit" ? "Depositar" : "Levantar"}
          </button>
        ))}
      </div>

      <div className="card space-y-4">
        <div className="space-y-2">
          <label className="label">Valor (USDC)</label>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="input text-2xl font-semibold tabular-nums"
            placeholder="0"
          />
          <div className="flex gap-2">
            {QUICK_AMOUNTS.map((quickAmount) => (
              <button
                key={quickAmount}
                onClick={() => setAmount(quickAmount)}
                className="btn-ghost !py-1 !px-3 !text-xs bg-surface2"
              >
                {quickAmount}
              </button>
            ))}
            <button
              onClick={() => setAmount(usdcBalance !== undefined ? formatUSDC(usdcBalance) : "0")}
              className="btn-ghost !py-1 !px-3 !text-xs bg-surface2 ml-auto"
            >
              Máx
            </button>
          </div>
        </div>

        <button
          onClick={() =>
            void run(
              submit,
              mode === "wrap"
                ? "USDC wrapped into cUSDC."
                : mode === "deposit"
                  ? "Encrypted deposit sent."
                  : "Encrypted withdrawal sent.",
            )
          }
          disabled={!ready || status === "working"}
          className="btn-primary w-full"
        >
          {status === "working" ? (
            <>
              <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              A enviar...
            </>
          ) : mode === "wrap" ? (
            "Wrap USDC to cUSDC"
          ) : mode === "deposit" ? (
            "Depositar cUSDC encrypted"
          ) : (
            "Levantar principal encrypted"
          )}
        </button>

        {lastTx && <p className="text-xs text-success break-all">Tx: {lastTx}</p>}
        <p className={`text-sm ${status === "error" ? "text-danger" : status === "success" ? "text-success" : "text-muted"}`}>
          {message}
        </p>
      </div>
    </div>
  );
}
