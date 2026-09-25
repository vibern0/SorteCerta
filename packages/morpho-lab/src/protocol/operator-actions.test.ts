import { getAddress, type Address } from "viem";
import { describe, expect, it } from "vitest";

import { buildCloseDraw } from "./operator-actions";

const currentPool = getAddress(
  "0x1111111111111111111111111111111111111111"
);
const retiredPool = getAddress(
  "0x2222222222222222222222222222222222222222"
);

describe("buildCloseDraw", () => {
  it("targets the current configured pool with closeDraw() and no value", () => {
    const call = buildCloseDraw(
      { pool: currentPool.toLowerCase() as Address },
      { deployment: { pool: currentPool.toLowerCase() as Address }, pool: { drawId: 12n } }
    );

    expect(call.address).toBe(currentPool);
    expect(call.functionName).toBe("closeDraw");
    expect(call.args).toEqual([]);
    expect(call).not.toHaveProperty("value");
  });

  it("refuses to target a pool that is no longer the refreshed deployment", () => {
    expect(() =>
      buildCloseDraw(
        { pool: currentPool },
        { deployment: { pool: retiredPool }, pool: { drawId: 12n } }
      )
    ).toThrow(/binding changed/i);
  });
});
