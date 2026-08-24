"use client";

import type { FhevmInstance } from "@zama-fhe/relayer-sdk/web";
import { RPC_URL } from "./contracts";

let instancePromise: Promise<FhevmInstance> | undefined;

export function getZamaInstance() {
  if (!instancePromise) {
    instancePromise = (async () => {
      const { createInstance, initSDK, SepoliaConfig } = await import("@zama-fhe/relayer-sdk/web");
      await initSDK();
      return createInstance({
        ...SepoliaConfig,
        network: RPC_URL,
      });
    })();
  }

  return instancePromise;
}

export function userDecryptTimestamp() {
  return Math.floor(Date.now() / 1000);
}
