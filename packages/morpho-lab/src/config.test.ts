import { describe, expect, it } from "vitest";

import { loadLabConfig, validateLabConfig } from "./config";

describe("loadLabConfig", () => {
  it("loads checksummed current deployment defaults", () => {
    const config = loadLabConfig({});

    expect(config.chainId).toBe(11155111);
    expect(config.pool).toBe("0x9c23E5f7143612dc1232FC643A57300291e0d719");
    expect(config.adapter).toBe("0x784C2020a2fbf4a106881E37B673A93604A9559D");
  });

  it("rejects invalid address overrides", () => {
    expect(() => loadLabConfig({ VITE_MORPHO_ADDRESS: "bad" })).toThrow(
      "Morpho address",
    );
  });

  it("rejects a config for the wrong chain", () => {
    expect(() =>
      validateLabConfig({ ...loadLabConfig({}), chainId: 1 }),
    ).toThrow("11155111");
  });
});
