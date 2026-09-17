import type { FhevmInstance } from "@zama-fhe/relayer-sdk/web";
import { getAddress, toHex, type Address } from "viem";

let instance: { rpcUrl: string; promise: Promise<FhevmInstance> } | undefined;

export async function encryptPrizeAmount(
  rpcUrl: string,
  wrapper: Address,
  account: Address,
  amount: bigint
) {
  if (!instance || instance.rpcUrl !== rpcUrl) {
    const promise = (async () => {
      const { createInstance, initSDK, SepoliaConfig } = await import(
        "@zama-fhe/relayer-sdk/web"
      );
      await initSDK();
      return createInstance({ ...SepoliaConfig, network: rpcUrl });
    })();
    instance = { rpcUrl, promise };
    void promise.catch(() => {
      if (instance?.promise === promise) instance = undefined;
    });
  }
  const zama = await instance.promise;
  const encrypted = await zama
    .createEncryptedInput(getAddress(wrapper), getAddress(account))
    .add64(amount)
    .encrypt();
  return {
    handle: toHex(encrypted.handles[0]),
    proof: toHex(encrypted.inputProof),
  };
}
