import { describe, expect, it } from "vitest";

import { loadLabConfig, validateLabConfig } from "./config";

describe("loadLabConfig", () => {
  it("loads checksummed current deployment defaults", () => {
    const config = loadLabConfig({});

    expect(config.chainId).toBe(11155111);
    expect(config.pool).toBe("0xe65D6459a7Ce01315FbB0998C37233c6FeE3aB8b");
    expect(config.adapter).toBe("0x784C2020a2fbf4a106881E37B673A93604A9559D");
  });

  it("rejects invalid address overrides", () => {
    expect(() => loadLabConfig({ VITE_MORPHO_ADDRESS: "bad" })).toThrow(
      "Morpho address",
    );
  });

  it("rejects a config for the wrong chain", () => {
    expect(() => {
      validateLabConfig({ ...loadLabConfig({}), chainId: 1 });
    }).toThrow("11155111");
  });
});
