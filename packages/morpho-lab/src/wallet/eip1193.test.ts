import { describe, expect, it } from "vitest";

import { selectMetaMaskProvider, type Eip1193Provider } from "./eip1193";

describe("selectMetaMaskProvider", () => {
  it("rejects a provider that is not MetaMask", () => {
    const provider = createProvider();

    expect(selectMetaMaskProvider(provider)).toBeUndefined();
  });

  it("selects the MetaMask candidate from injected provider candidates", () => {
    const metaMask = createProvider({ isMetaMask: true });
    const provider = createProvider({ providers: [createProvider(), metaMask] });

    expect(selectMetaMaskProvider(provider)).toBe(metaMask);
  });
});

function createProvider(
  overrides: Partial<Eip1193Provider> = {}
): Eip1193Provider {
  return {
    request: async () => undefined,
    on: () => undefined,
    removeListener: () => undefined,
    ...overrides,
  };
}
