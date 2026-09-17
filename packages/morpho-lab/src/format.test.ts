import { describe, expect, it } from "vitest";

import { formatPercent, formatTimestamp, formatToken } from "./format";

describe("formatters", () => {
  it("preserves requested token precision", () => {
    expect(formatToken(56_899_999n, 6, 6)).toBe("56.899999");
  });

  it("formats wad values as percentages", () => {
    expect(formatPercent(188_568_737_998_987_965n)).toBe("18.86%");
  });

  it("marks unavailable timestamps", () => {
    expect(formatTimestamp(undefined)).toBe("Unavailable");
  });
});
