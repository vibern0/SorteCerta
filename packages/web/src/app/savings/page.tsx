"use client";

import { useMemo, useState } from "react";
import { createPublicClient, encodeEventTopics, encodeFunctionData, getAddress, http, isAddress, parseEventLogs, toHex } from "viem";
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

type Mode = "deposit" | "withdraw" | "unwrap";
type Status = "idle" | "working" | "success" | "error";

const QUICK_AMOUNTS = ["10", "25", "50", "100"];
const ZERO_HANDLE = "0x0000000000000000000000000000000000000000000000000000000000000000";

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

function isZeroHandle(handle: unknown) {
  return typeof handle === "string" && handle.toLowerCase() === ZERO_HANDLE;
}

type DecryptRequest = {
  key: "confidentialBalance" | "principal";
  handle: `0x${string}`;
  contract: `0x${string}`;
};

type PendingUnwrap = {
  requestId: `0x${string}`;
  txHash: `0x${string}`;
};

export default function SavingsPage() {
  const [account, setAccount] = useState<`0x${string}` | undefined>();
  const [mode, setMode] = useState<Mode>("deposit");
  const [amount, setAmount] = useState("25");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("Connect an injected wallet to use confidential savings.");
  const [usdcBalance, setUsdcBalance] = useState<bigint | undefined>();
  const [allowance, setAllowance] = useState<bigint | undefined>();
  const [confidentialBalance, setConfidentialBalance] = useState<bigint | undefined>();
  const [principal, setPrincipal] = useState<bigint | undefined>();
  const [lastTx, setLastTx] = useState<string | undefined>();
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
  const actionReady = mode === "unwrap" ? wrapperReady : poolReady;
  const maxAmount = mode === "deposit" ? usdcBalance : mode === "withdraw" ? principal : confidentialBalance;

  async function connect() {
    if (!window.ethereum) throw new Error("Injected wallet not found.");

    const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as unknown[];
    const connected = asAddress(accounts[0], "User address");
    setAccount(connected);
    await refreshBalances(connected);
    await refreshPendingUnwraps(connected);

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

  async function sendTx(to: `0x${string}`, data: `0x${string}`, from: `0x${string}`) {
    if (!window.ethereum) throw new Error("Injected wallet not found.");

    await ensureSepolia();
    const tx = (await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [{ from, to, data }],
    })) as `0x${string}`;
    setLastTx(tx);
    return publicClient.waitForTransactionReceipt({ hash: tx });
  }

  function rememberUnwrapRequest(receipt: Awaited<ReturnType<typeof publicClient.waitForTransactionReceipt>>) {
    const events = parseEventLogs({
      abi: confidentialUsdcAbi,
      eventName: "UnwrapRequested",
      logs: receipt.logs,
    });
    const requestId = events.at(-1)?.args.unwrapRequestId;
    if (requestId) {
      setPendingUnwraps((current) => [
        { requestId, txHash: receipt.transactionHash },
        ...current.filter((request) => request.requestId !== requestId),
      ]);
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

  async function refreshPendingUnwraps(user = account) {
    if (!user || !wrapperReady) return;

    const token = asAddress(addresses.confidentialUsdc, "Confidential USDC");
    const latestBlock = await publicClient.getBlockNumber();
    const fromBlock = latestBlock > 10_000n ? latestBlock - 10_000n : 0n;
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
    const pending = (
      await Promise.all(
        requested.map(async (event) => {
          const requestId = event.args.unwrapRequestId;
          if (!requestId || finalizedIds.has(requestId.toLowerCase())) return undefined;
          const requester = await publicClient.readContract({
            address: token,
            abi: confidentialUsdcAbi,
            functionName: "unwrapRequester",
            args: [requestId],
          });
          if (requester === "0x0000000000000000000000000000000000000000") return undefined;
          return { requestId, txHash: event.transactionHash };
        }),
      )
    ).filter((request): request is PendingUnwrap => request !== undefined);

    setPendingUnwraps(pending.reverse());
  }

  async function finalizeUnwrap(requestId: `0x${string}`) {
    const user = await activeAccount();
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
    await sendTx(token, data, user);
    await refreshBalances(user);
    await refreshPendingUnwraps(user);
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

  async function depositConfidential() {
    const user = await activeAccount();
    const value = parseUSDC(amount);
    if (value === 0n) throw new Error("Valor invalido.");
    if (!poolReady) throw new Error("Confidential prize pool address is not configured.");

    await approveIfNeeded(user, value);
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
      args: [pool, toHex(encrypted.handles[0]) as `0x${string}`, toHex(encrypted.inputProof), "0x"],
    });
    const data = encodeFunctionData({
      abi: confidentialUsdcAbi,
      functionName: "multicall",
      args: [[wrapCall, depositCall]],
    });
    await sendTx(token, data, user);
    setAmount("");
    await decryptConfidentialState(user);
  }

  async function withdrawConfidential() {
    const user = await activeAccount();
    const value = parseUSDC(amount);
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
    const receipt = await sendTx(pool, data, user);
    rememberUnwrapRequest(receipt);
    await refreshBalances(user);
    setAmount("");
    setPrincipal(undefined);
  }

  async function unwrapConfidential() {
    const user = await activeAccount();
    const value = parseUSDC(amount);
    if (value === 0n) throw new Error("Valor invalido.");
    if (!wrapperReady) throw new Error("Confidential USDC address is not configured.");

    const token = asAddress(addresses.confidentialUsdc, "Confidential USDC");
    const zama = await getZamaInstance();
    const encrypted = await zama.createEncryptedInput(token, user).add64(value).encrypt();
    const data = encodeFunctionData({
      abi: confidentialUsdcAbi,
      functionName: "unwrap",
      args: [user, user, toHex(encrypted.handles[0]) as `0x${string}`, toHex(encrypted.inputProof)],
    });
    const receipt = await sendTx(token, data, user);
    rememberUnwrapRequest(receipt);
    await refreshBalances(user);
    setAmount("");
    setConfidentialBalance(undefined);
  }

  async function decryptHandles(requests: DecryptRequest[], user: `0x${string}`) {
    if (!window.ethereum) throw new Error("Injected wallet not found.");
    if (requests.length === 0) return {};

    const zama = await getZamaInstance();
    const keypair = zama.generateKeypair();
    const startTimestamp = userDecryptTimestamp();
    const durationDays = 365;
    const contracts = Array.from(new Set(requests.map((request) => request.contract)));
    const eip712 = zama.createEIP712(keypair.publicKey, contracts, startTimestamp, durationDays);
    const signature = (await window.ethereum.request({
      method: "eth_signTypedData_v4",
      params: [user, stringifyTypedData(eip712)],
    })) as string;

    const results = await zama.userDecrypt(
      requests.map((request) => ({ handle: request.handle, contractAddress: request.contract })),
      keypair.privateKey,
      keypair.publicKey,
      signature,
      contracts,
      user,
      startTimestamp,
      durationDays,
    );

    return Object.fromEntries(requests.map((request) => [request.key, results[request.handle]]));
  }

  async function decryptConfidentialState(currentUser?: `0x${string}`) {
    const user = currentUser ?? (await activeAccount());
    if (!wrapperReady) throw new Error("Confidential USDC address is not configured.");

    const token = asAddress(addresses.confidentialUsdc, "Confidential USDC");

    const decryptRequests: DecryptRequest[] = [];
    const balanceHandle = await publicClient.readContract({
      address: token,
      abi: confidentialUsdcAbi,
      functionName: "confidentialBalanceOf",
      args: [user],
    });

    if (isZeroHandle(balanceHandle)) {
      setConfidentialBalance(0n);
    } else {
      decryptRequests.push({
        key: "confidentialBalance",
        handle: balanceHandle as `0x${string}`,
        contract: token,
      });
    }

    if (poolReady) {
      const pool = asAddress(addresses.pool, "Confidential prize pool");
      const principalHandle = await publicClient.readContract({
        address: pool,
        abi: confidentialPrizePoolAbi,
        functionName: "encryptedPrincipalOf",
        args: [user],
      });
      if (isZeroHandle(principalHandle)) {
        setPrincipal(0n);
      } else {
        decryptRequests.push({
          key: "principal",
          handle: principalHandle as `0x${string}`,
          contract: pool,
        });
      }
    } else {
      setPrincipal(undefined);
    }

    const decrypted = await decryptHandles(decryptRequests, user);
    if (decrypted.confidentialBalance !== undefined) {
      setConfidentialBalance(BigInt(String(decrypted.confidentialBalance)));
    }
    if (decrypted.principal !== undefined) {
      setPrincipal(BigInt(String(decrypted.principal)));
    }

    await refreshBalances(user);
  }

  async function submit() {
    if (mode === "deposit") await depositConfidential();
    if (mode === "withdraw") await withdrawConfidential();
    if (mode === "unwrap") await unwrapConfidential();
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
        <p className="font-mono text-xs break-all text-muted">USDC: {usdcReady ? addresses.usdc : "missing"}</p>
        <p className="font-mono text-xs break-all text-muted">
          cUSDC: {wrapperReady ? addresses.confidentialUsdc : "missing"}
        </p>
        <p className="font-mono text-xs break-all text-muted">Pool: {poolReady ? addresses.pool : "missing"}</p>
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
          <span className="font-semibold tabular-nums">{formatUSDC(confidentialBalance)} cUSDC</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted text-sm">Principal no pool</span>
          <span className="font-semibold tabular-nums text-brand">{formatUSDC(principal)} cUSDC</span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted text-sm">Pending unwraps</span>
            <button
              className="btn-ghost !py-1 !px-3 !text-xs bg-surface2"
              disabled={!wrapperReady || status === "working"}
              onClick={() => void run(async () => void (await refreshPendingUnwraps()), "Pending unwraps refreshed.")}
            >
              Refresh
            </button>
          </div>
          {pendingUnwraps.length === 0 ? (
            <p className="text-xs text-muted">No pending unwrap requests.</p>
          ) : (
            pendingUnwraps.map((request) => (
              <div key={request.requestId} className="space-y-2 rounded-lg bg-surface2 p-3">
                <p className="font-mono text-xs break-all text-muted">{request.requestId}</p>
                <button
                  className="btn-secondary w-full"
                  disabled={status === "working"}
                  onClick={() => void run(() => finalizeUnwrap(request.requestId), "Unwrap finalized.")}
                >
                  Finalize unwrap
                </button>
              </div>
            ))
          )}
        </div>
        <button
          className="btn-secondary w-full"
          disabled={!wrapperReady || status === "working"}
          onClick={() => void run(decryptConfidentialState, "Confidential balances decrypted.")}
        >
          Decrypt balances
        </button>
      </div>

      <div className="flex gap-1 bg-surface2 p-1 rounded-xl">
        {(["deposit", "withdraw", "unwrap"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`font-display flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
              mode === m ? "bg-bg text-text" : "text-muted hover:text-text"
            }`}
          >
            {m === "deposit" ? "Depositar" : m === "withdraw" ? "Levantar" : "Unwrap"}
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
              onClick={() => setAmount(maxAmount !== undefined ? formatUSDC(maxAmount, 6) : "0")}
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
              mode === "deposit"
                ? "USDC wrapped and deposited confidentially."
                : mode === "withdraw"
                  ? "Encrypted withdrawal and USDC unwrap requested."
                  : "USDC unwrap requested.",
            )
          }
          disabled={!actionReady || status === "working"}
          className="btn-primary w-full"
        >
          {status === "working" ? (
            <>
              <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              A enviar...
            </>
          ) : mode === "deposit" ? (
            "Depositar USDC privately"
          ) : mode === "withdraw" ? (
            "Levantar para USDC"
          ) : (
            "Unwrap cUSDC to USDC"
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
