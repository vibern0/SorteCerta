"use client";

import { createPublicClient, getAddress, http, isAddress } from "viem";
import { sepolia } from "viem/chains";
import {
  CONTRACTS,
  RPC_URL,
  confidentialPrizePoolAbi,
  confidentialUsdcAbi,
} from "./contracts";
import {
  signOwnerTypedData,
  signSmartTypedData,
  type SmartSession,
} from "./web3auth";
import { getZamaInstance, userDecryptTimestamp } from "./zama";

const ZERO_HANDLE = "0x0000000000000000000000000000000000000000000000000000000000000000";

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(RPC_URL),
});

type DecryptRequest = {
  key: "confidentialBalance" | "principal";
  handle: `0x${string}`;
  contract: `0x${string}`;
};

type DecryptedBalances = {
  confidentialBalance?: bigint;
  principal?: bigint;
};

function asAddress(value: unknown, label: string) {
  if (typeof value !== "string" || !isAddress(value)) {
    throw new Error(`${label} is not a valid address.`);
  }

  return getAddress(value);
}

function isZeroHandle(handle: unknown) {
  return typeof handle === "string" && handle.toLowerCase() === ZERO_HANDLE;
}

async function decryptHandles(
  requests: DecryptRequest[],
  currentSession: SmartSession,
  signer: "owner" | "smart",
) {
  if (requests.length === 0) return {};

  const zama = await getZamaInstance();
  const keypair = zama.generateKeypair();
  const startTimestamp = userDecryptTimestamp();
  const durationDays = 365;
  const contracts = Array.from(new Set(requests.map((request) => request.contract)));
  const eip712 = zama.createEIP712(keypair.publicKey, contracts, startTimestamp, durationDays);
  const signature =
    signer === "owner"
      ? await signOwnerTypedData(currentSession, eip712)
      : await signSmartTypedData(currentSession, eip712);
  const userAddress = signer === "owner" ? currentSession.ownerAddress : currentSession.address;

  const results = await zama.userDecrypt(
    requests.map((request) => ({ handle: request.handle, contractAddress: request.contract })),
    keypair.privateKey,
    keypair.publicKey,
    signature,
    contracts,
    userAddress,
    startTimestamp,
    durationDays,
  );

  return Object.fromEntries(requests.map((request) => [request.key, results[request.handle]]));
}

export async function decryptConfidentialBalances(
  currentSession: SmartSession,
): Promise<DecryptedBalances> {
  const user = currentSession.address;
  const token = asAddress(CONTRACTS.confidentialUsdc, "Confidential USDC");
  const pool = asAddress(CONTRACTS.confidentialPrizePool, "Confidential prize pool");

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

  const balances: DecryptedBalances = {};
  const smartRequests: DecryptRequest[] = [];
  const ownerRequests: DecryptRequest[] = [];

  if (isZeroHandle(balanceHandle)) {
    balances.confidentialBalance = 0n;
  } else {
    smartRequests.push({
      key: "confidentialBalance",
      handle: balanceHandle as `0x${string}`,
      contract: token,
    });
  }

  if (isZeroHandle(principalHandle)) {
    balances.principal = 0n;
  } else {
    ownerRequests.push({
      key: "principal",
      handle: principalHandle as `0x${string}`,
      contract: pool,
    });
  }

  const [smartDecrypted, ownerDecrypted] = await Promise.allSettled([
    decryptHandles(smartRequests, currentSession, "smart"),
    decryptHandles(ownerRequests, currentSession, "owner"),
  ]);

  for (const decrypted of [smartDecrypted, ownerDecrypted]) {
    if (decrypted.status !== "fulfilled") continue;
    if (decrypted.value.confidentialBalance !== undefined) {
      balances.confidentialBalance = BigInt(String(decrypted.value.confidentialBalance));
    }
    if (decrypted.value.principal !== undefined) {
      balances.principal = BigInt(String(decrypted.value.principal));
    }
  }

  return balances;
}
