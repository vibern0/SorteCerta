import { describe, expect, it } from "vitest";

import { loadLabConfig } from "./config";

describe("loadLabConfig", () => {
  it("loads checksummed current deployment defaults", () => {
    const config = loadLabConfig({});

    expect(config.chainId).toBe(11155111);
    expect(config.pool).toBe("0x3d974cEF83CaC5BfD970CA95E121774eb8C9f233");
    expect(config.adapter).toBe("0x84B120Db8b600DE01A49143cf515246B79afcfef");
  });

  it("rejects invalid address overrides", () => {
    expect(() => loadLabConfig({ VITE_MORPHO_ADDRESS: "bad" })).toThrow(
      "Morpho address",
    );
  });
});
