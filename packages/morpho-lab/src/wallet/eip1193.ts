export type Eip1193Request = {
  method: string;
  params?: unknown[] | Record<string, unknown>;
};

export type Eip1193Provider = {
  request(request: Eip1193Request): Promise<unknown>;
  on(event: "accountsChanged" | "chainChanged", listener: (...args: unknown[]) => void): void;
  removeListener(
    event: "accountsChanged" | "chainChanged",
    listener: (...args: unknown[]) => void
  ): void;
};

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export {};
