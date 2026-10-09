"use client";

import Safe, {
  buildSignatureBytes,
  getP256VerifierAddress,
  type ExtractedPasskeyData,
  type PasskeyArgType,
} from "@safe-global/protocol-kit";
import { Safe4337Pack } from "@safe-global/relay-kit";
import {
  createPublicClient,
  getAddress,
  hashTypedData,
  http,
  keccak256,
  type Address,
  type Hex,
} from "viem";
import { entryPoint07Address } from "viem/account-abstraction";
import { sepolia } from "viem/chains";

import {
  writePasskeyMetadata,
  type PasskeyMetadata,
} from "./passkey-metadata.ts";
import {
  createKettigoCredential,
  getKettigoCredential,
} from "./passkey-webauthn.ts";
import { publicConfig } from "./runtime-config.ts";
import type { PasskeySmartSession, SmartAccountCall } from "./smart-session.ts";

const SAFE_VERSION = "1.4.1" as const;
const SAFE_MODULES_VERSION = "0.3.0";
const DEFAULT_RECEIPT_TIMEOUT_MS = 120_000;
const DEFAULT_RECEIPT_POLL_MS = 1_500;
const RPC_URL = publicConfig("NEXT_PUBLIC_RPC_URL", process.env.NEXT_PUBLIC_RPC_URL);
const PIMLICO_API_KEY = publicConfig("NEXT_PUBLIC_PIMLICO_API_KEY", process.env.NEXT_PUBLIC_PIMLICO_API_KEY);
const PIMLICO_URL = `https://api.pimlico.io/v2/sepolia/rpc?apikey=${PIMLICO_API_KEY}`;

type PasskeyStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type SafeSignature = Parameters<typeof buildSignatureBytes>[0][number];

type ProtocolKitLike = {
  getAddress(): Promise<string>;
  signHash(hash: string): Promise<SafeSignature>;
};

type UserOperationReceiptLike = {
  success: boolean;
  receipt: { transactionHash: string };
};

type RelayLike = {
  protocolKit: ProtocolKitLike;
  createTransaction(input: {
    transactions: Array<{ to: string; data: string; value: string }>;
  }): Promise<unknown>;
  signSafeOperation(operation: unknown): Promise<unknown>;
  executeTransaction(input: { executable: unknown }): Promise<string>;
  getUserOperationReceipt(userOperationHash: string): Promise<UserOperationReceiptLike | null>;
};

type RelayInitOptions = Parameters<typeof Safe4337Pack.init>[0];

type PasskeySafeDependencies = {
  createCredential(input: { rpId: string; rpName: string }): Promise<Credential>;
  extractPasskeyData(credential: Credential): Promise<ExtractedPasskeyData>;
  getVerifierAddress(chainId: string): string;
  initRelay(options: RelayInitOptions): Promise<RelayLike>;
  getCode(address: Address): Promise<Hex | undefined>;
  getCredential(rawId: string, rpId: string, options?: CredentialRequestOptions): Promise<Credential>;
  sleep(milliseconds: number): Promise<void>;
};

type ReceiptWaitOptions = {
  timeoutMs?: number;
  pollMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
};

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(RPC_URL),
});

const defaultDependencies: PasskeySafeDependencies = {
  createCredential: ({ rpId, rpName }) => createKettigoCredential({ rpId, rpName }),
  extractPasskeyData: (credential) => Safe.createPasskeySigner(credential),
  getVerifierAddress: getP256VerifierAddress,
  initRelay: (options) => Safe4337Pack.init(options) as Promise<RelayLike>,
  getCode: (address) => publicClient.getCode({ address }),
  getCredential: (rawId, rpId, options) => getKettigoCredential(rawId, { rpId }, options),
  sleep: (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds)),
};

export async function createPasskeyAccount(
  input: { rpId: string; rpName: string; storage?: PasskeyStorage },
  dependencies: Partial<PasskeySafeDependencies> = {},
): Promise<PasskeySmartSession> {
  const deps = withDependencies(dependencies);
  const credential = await deps.createCredential({ rpId: input.rpId, rpName: input.rpName });
  const extracted = await deps.extractPasskeyData(credential);
  const metadata = signerMetadata(extracted, deps.getVerifierAddress(String(sepolia.id)));
  const relay = await deps.initRelay(relayOptions(metadata, predictedOptions(metadata.rawId), input.rpId, deps));
  const address = getAddress(await relay.protocolKit.getAddress());
  const stored = writePasskeyMetadata({ ...metadata, safeAddress: address }, input.storage);
  return createSession(relay, stored.safeAddress, deps);
}

export async function restorePasskeyAccount(
  input: { metadata: PasskeyMetadata; rpId: string },
  dependencies: Partial<PasskeySafeDependencies> = {},
): Promise<PasskeySmartSession> {
  const deps = withDependencies({
    ...dependencies,
  });
  const expectedAddress = getAddress(input.metadata.safeAddress);
  const code = await deps.getCode(expectedAddress);
  const options = code && code !== "0x"
    ? { safeAddress: expectedAddress }
    : predictedOptions(input.metadata.rawId);
  const relay = await deps.initRelay(relayOptions(input.metadata, options, input.rpId, deps));
  const derivedAddress = getAddress(await relay.protocolKit.getAddress());
  if (derivedAddress !== expectedAddress) {
    throw new Error("The restored Safe address does not match the saved account.");
  }
  return createSession(relay, derivedAddress, deps);
}

export function buildPasskeySigner(
  metadata: Pick<PasskeyMetadata, "rawId" | "coordinates" | "verifierAddress">,
  rpId: string,
  dependencies: Pick<PasskeySafeDependencies, "getCredential">,
): PasskeyArgType {
  return {
    rawId: metadata.rawId,
    coordinates: metadata.coordinates,
    verifierAddress: getAddress(metadata.verifierAddress),
    getFn: (options) => dependencies.getCredential(metadata.rawId, rpId, options),
  };
}

export async function signSafeTypedData(
  protocolKit: Pick<ProtocolKitLike, "signHash">,
  typedData: unknown,
): Promise<Hex> {
  const digest = hashTypedData(typedData as Parameters<typeof hashTypedData>[0]);
  const ownerSignature = await protocolKit.signHash(digest);
  return buildSignatureBytes([ownerSignature]) as Hex;
}

export async function waitForUserOperationTransaction(
  relay: Pick<RelayLike, "getUserOperationReceipt">,
  userOperationHash: string,
  options: ReceiptWaitOptions = {},
): Promise<Hex> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_RECEIPT_TIMEOUT_MS;
  const pollMs = options.pollMs ?? DEFAULT_RECEIPT_POLL_MS;
  const sleep = options.sleep ?? defaultDependencies.sleep;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    const receipt = await relay.getUserOperationReceipt(userOperationHash);
    if (receipt) {
      if (!receipt.success) throw new Error("The sponsored transaction failed.");
      return receipt.receipt.transactionHash as Hex;
    }
    await sleep(pollMs);
  }

  throw new Error("The sponsored transaction is still pending. Please try again.");
}

function createSession(
  relay: RelayLike,
  address: Address,
  deps: PasskeySafeDependencies,
): PasskeySmartSession {
  return {
    address: getAddress(address),
    signTypedData: (typedData) => signSafeTypedData(relay.protocolKit, typedData),
    sendTransaction: async (calls) => sendCalls(relay, calls, deps),
  };
}

async function sendCalls(
  relay: RelayLike,
  calls: SmartAccountCall[],
  deps: PasskeySafeDependencies,
): Promise<Hex> {
  const operation = await relay.createTransaction({
    transactions: calls.map((call) => ({
      to: getAddress(call.to),
      data: call.data,
      value: (call.value ?? 0n).toString(),
    })),
  });
  const signed = await relay.signSafeOperation(operation);
  const userOperationHash = await relay.executeTransaction({ executable: signed });
  return waitForUserOperationTransaction(relay, userOperationHash, { sleep: deps.sleep });
}

function relayOptions(
  metadata: Pick<PasskeyMetadata, "rawId" | "coordinates" | "verifierAddress">,
  options: RelayInitOptions["options"],
  rpId: string,
  dependencies: Pick<PasskeySafeDependencies, "getCredential">,
): RelayInitOptions {
  const signer = buildPasskeySigner(metadata, rpId, dependencies);
  return {
    provider: RPC_URL,
    signer,
    bundlerUrl: PIMLICO_URL,
    safeModulesVersion: SAFE_MODULES_VERSION,
    customContracts: { entryPointAddress: entryPoint07Address },
    options,
    paymasterOptions: {
      isSponsored: true,
      paymasterUrl: PIMLICO_URL,
    },
  };
}

function predictedOptions(rawId: string): RelayInitOptions["options"] {
  return {
    owners: [],
    threshold: 1,
    safeVersion: SAFE_VERSION,
    saltNonce: BigInt(keccak256(`0x${rawId}` as Hex)).toString(),
  };
}

function signerMetadata(
  extracted: ExtractedPasskeyData,
  verifierAddress: string,
): Omit<PasskeyMetadata, "safeAddress"> {
  const rawId = extracted.rawId.replace(/^0x/, "").toLowerCase();
  if (!/^[a-f0-9]+$/.test(rawId) || rawId.length % 2 !== 0) {
    throw new Error("Safe returned invalid passkey metadata.");
  }
  return {
    rawId,
    coordinates: {
      x: extracted.coordinates.x as Hex,
      y: extracted.coordinates.y as Hex,
    },
    verifierAddress: getAddress(verifierAddress),
  };
}

function withDependencies(overrides: Partial<PasskeySafeDependencies>): PasskeySafeDependencies {
  return { ...defaultDependencies, ...overrides };
}
