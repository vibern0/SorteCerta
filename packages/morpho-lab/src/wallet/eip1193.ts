export type Eip1193Request = {
  method: string;
  params?: unknown[] | Record<string, unknown>;
};

export type Eip1193Provider = {
  isMetaMask?: boolean;
  providers?: Eip1193Provider[];
  request(request: Eip1193Request): Promise<unknown>;
  on(event: "accountsChanged" | "chainChanged", listener: (...args: unknown[]) => void): void;
  removeListener(
    event: "accountsChanged" | "chainChanged",
    listener: (...args: unknown[]) => void
  ): void;
};

export function selectMetaMaskProvider(
  provider: Eip1193Provider | undefined
): Eip1193Provider | undefined {
  const candidates = provider?.providers ?? [];
  return candidates.find((candidate) => candidate.isMetaMask) ??
    (provider?.isMetaMask ? provider : undefined);
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export {};
