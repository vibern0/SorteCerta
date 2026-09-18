import { describe, expect, it } from "vitest";

import { loadLabConfig } from "./config";

describe("loadLabConfig", () => {
  it("loads checksummed current deployment defaults", () => {
    const config = loadLabConfig({});

    expect(config.chainId).toBe(11155111);
    expect(config.pool).toBe("0xeA77fF10B0F7A1090Fe77B482c5556F6fa4a457B");
    expect(config.adapter).toBe("0x1B538b63D8d88e55D7D6394672474ae2c84326EF");
  });

  it("rejects invalid address overrides", () => {
    expect(() => loadLabConfig({ VITE_MORPHO_ADDRESS: "bad" })).toThrow(
      "Morpho address",
    );
  });
});
