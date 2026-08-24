"use client";

import { useMemo, useState } from "react";
import { createPublicClient, encodeFunctionData, formatUnits, getAddress, http, isAddress, toHex } from "viem";
import { sepolia } from "viem/chains";
import { CHAIN_ID, CONTRACTS, RPC_URL, zamaPrimitiveSpikeAbi } from "@/lib/contracts";
import { getZamaInstance, userDecryptTimestamp } from "@/lib/zama";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}

type Status = "idle" | "working" | "success" | "error";

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(RPC_URL),
});

function asHexAddress(value: unknown) {
  if (typeof value !== "string" || !isAddress(value)) {
    throw new Error("Wallet did not return an address.");
  }

  return getAddress(value);
}

function asContractAddress(value: unknown, name: string) {
  if (typeof value !== "string" || !isAddress(value)) {
    throw new Error(`${name} is not a valid address.`);
  }

  return getAddress(value);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function stringifyTypedData(value: unknown) {
  return JSON.stringify(value, (_key, data) => (typeof data === "bigint" ? data.toString() : data));
}

export default function ZamaSpikePage() {
  const [account, setAccount] = useState<`0x${string}` | undefined>();
  const [clearValue, setClearValue] = useState("42");
  const [decryptedValue, setDecryptedValue] = useState<string | undefined>();
  const [randomValue, setRandomValue] = useState<string | undefined>();
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("Connect injected wallet to test Zama EIP-712 decryption.");

  const spikeAddress = useMemo(
    () => (isAddress(CONTRACTS.zamaSpike) ? getAddress(CONTRACTS.zamaSpike) : CONTRACTS.zamaSpike),
    [],
  );
  const ready = useMemo(() => isAddress(spikeAddress), [spikeAddress]);

  async function connect() {
    if (!window.ethereum) {
      throw new Error("Injected wallet not found.");
    }

    const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as unknown[];
    const connectedAccount = asHexAddress(accounts[0]);
    setAccount(connectedAccount);

    return connectedAccount;
  }

  async function getActiveAccount() {
    if (account) {
      return account;
    }

    return connect();
  }

  async function ensureSepolia() {
    if (!window.ethereum) {
      throw new Error("Injected wallet not found.");
    }

    const chainId = await window.ethereum.request({ method: "eth_chainId" });
    if (chainId !== `0x${CHAIN_ID.toString(16)}`) {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${CHAIN_ID.toString(16)}` }],
      });
    }
  }

  async function submitEncryptedValue() {
    if (!window.ethereum) {
      throw new Error("Injected wallet not found.");
    }
    const activeAccount = await getActiveAccount();
    const spike = asContractAddress(spikeAddress, "Zama spike contract");
    const value = BigInt(clearValue || "0");
    const zama = await getZamaInstance();
    const encryptedInput = await zama.createEncryptedInput(spike, activeAccount).add32(value).encrypt();
    const data = encodeFunctionData({
      abi: zamaPrimitiveSpikeAbi,
      functionName: "submitValue",
      args: [toHex(encryptedInput.handles[0]) as `0x${string}`, toHex(encryptedInput.inputProof)],
    });

    await ensureSepolia();
    await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [{ from: activeAccount, to: spike, data }],
    });
  }

  async function decryptHandle(handle: `0x${string}`, activeAccount?: `0x${string}`) {
    if (!window.ethereum) {
      throw new Error("Injected wallet not found.");
    }

    const decryptAccount = activeAccount ?? (await getActiveAccount());
    const spike = asContractAddress(spikeAddress, "Zama spike contract");
    const zama = await getZamaInstance();
    const keypair = zama.generateKeypair();
    const startTimestamp = userDecryptTimestamp();
    const durationDays = 365;
    const eip712 = zama.createEIP712(keypair.publicKey, [spike], startTimestamp, durationDays);
    const signature = (await window.ethereum.request({
      method: "eth_signTypedData_v4",
      params: [decryptAccount, stringifyTypedData(eip712)],
    })) as string;

    const results = await zama.userDecrypt(
      [{ handle, contractAddress: spike }],
      keypair.privateKey,
      keypair.publicKey,
      signature,
      [spike],
      decryptAccount,
      startTimestamp,
      durationDays,
    );

    return results[handle];
  }

  async function decryptStoredValue() {
    const activeAccount = await getActiveAccount();
    const spike = asContractAddress(spikeAddress, "Zama spike contract");

    const handle = (await publicClient.readContract({
      address: spike,
      abi: zamaPrimitiveSpikeAbi,
      functionName: "getValue",
      args: [activeAccount],
    })) as `0x${string}`;

    const value = await decryptHandle(handle, activeAccount);
    setDecryptedValue(String(value));
  }

  async function drawAndDecryptRandom() {
    if (!window.ethereum) {
      throw new Error("Injected wallet not found.");
    }
    const activeAccount = await getActiveAccount();
    const spike = asContractAddress(spikeAddress, "Zama spike contract");

    await ensureSepolia();
    const data = encodeFunctionData({
      abi: zamaPrimitiveSpikeAbi,
      functionName: "drawRandomForCaller",
    });

    await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [{ from: activeAccount, to: spike, data }],
    });

    const handle = (await publicClient.readContract({
      address: spike,
      abi: zamaPrimitiveSpikeAbi,
      functionName: "getLastRandom",
    })) as `0x${string}`;
    const value = await decryptHandle(handle, activeAccount);
    setRandomValue(String(value));
  }

  async function run(action: () => Promise<void>, successMessage: string) {
    setStatus("working");
    setMessage("Working...");
    try {
      await action();
      setStatus("success");
      setMessage(successMessage);
    } catch (error) {
      setStatus("error");
      setMessage(getErrorMessage(error));
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <section className="space-y-3">
        <span className="pill">Phase 1 Zama spike</span>
        <h1 className="font-display text-4xl font-bold leading-tight">EIP-712 decrypt</h1>
        <p className="text-muted leading-relaxed">
          Minimal injected-wallet path for encrypted input, ACL, and user decryption.
        </p>
      </section>

      <section className="card space-y-4">
        <div>
          <p className="label">Contract</p>
          <p className="font-mono text-xs break-all text-muted">{ready ? spikeAddress : "NEXT_PUBLIC_ZAMA_SPIKE_ADDRESS missing"}</p>
        </div>

        <button className="btn-secondary w-full" onClick={() => void run(async () => void (await connect()), "Wallet connected.")}>
          {account ? account : "Connect injected wallet"}
        </button>
        {account && <p className="font-mono text-xs break-all text-muted">User: {account}</p>}

        <label className="block space-y-2">
          <span className="label">Encrypted value</span>
          <input
            className="w-full rounded-2xl border border-line bg-surface px-4 py-3 font-mono text-sm outline-none"
            inputMode="numeric"
            value={clearValue}
            onChange={(event) => setClearValue(event.target.value)}
          />
        </label>

        <div className="grid grid-cols-1 gap-3">
          <button
            className="btn-primary w-full"
            disabled={!ready || status === "working"}
            onClick={() => void run(submitEncryptedValue, "Encrypted value submitted.")}
          >
            Submit encrypted value
          </button>
          <button
            className="btn-secondary w-full"
            disabled={!ready || status === "working"}
            onClick={() => void run(decryptStoredValue, "Stored value decrypted.")}
          >
            Decrypt stored value
          </button>
          <button
            className="btn-secondary w-full"
            disabled={!ready || status === "working"}
            onClick={() => void run(drawAndDecryptRandom, "Random value decrypted.")}
          >
            Draw random and decrypt
          </button>
        </div>
      </section>

      <section className="card space-y-3">
        <p className="label">Result</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted">Stored value</p>
            <p className="font-display text-2xl font-bold">{decryptedValue ?? "-"}</p>
          </div>
          <div>
            <p className="text-muted">Random 0-15</p>
            <p className="font-display text-2xl font-bold">{randomValue ?? "-"}</p>
          </div>
        </div>
        <p className={`text-sm ${status === "error" ? "text-danger" : status === "success" ? "text-success" : "text-muted"}`}>
          {message}
        </p>
        <p className="text-xs text-muted">Debug only. 1 test unit = {formatUnits(1n, 0)} encrypted integer.</p>
      </section>
    </div>
  );
}
