import {
  createConfig,
  memoryStorage,
  ZamaSDK,
  type DecryptPublicValuesResult,
  type Hex as ZamaHex,
} from "@zama-fhe/sdk";
import { sepolia as zamaSepolia } from "@zama-fhe/sdk/chains";
import { node } from "@zama-fhe/sdk/node";
import { ViemProvider } from "@zama-fhe/sdk/viem";
import { createPublicClient, http, type Hex } from "viem";
import { sepolia } from "viem/chains";

const PUBLIC_DECRYPT_TIMEOUT_MS = 8_000;

export async function decryptPublicHandles(
  handles: Hex[],
  rpcUrl: string,
): Promise<DecryptPublicValuesResult> {
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl),
  });
  const chain = {
    ...zamaSepolia,
    network: rpcUrl,
  };
  const sdk = new ZamaSDK(createConfig({
    chains: [chain],
    provider: new ViemProvider({ publicClient }),
    storage: memoryStorage,
    relayers: { [chain.id]: node({ timeout: PUBLIC_DECRYPT_TIMEOUT_MS }) },
  }));

  try {
    return await sdk.decryption.decryptPublicValues(handles as ZamaHex[], { timeout: PUBLIC_DECRYPT_TIMEOUT_MS });
  } finally {
    sdk.terminate();
  }
}
