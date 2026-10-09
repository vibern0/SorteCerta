import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("landing Worker configuration", () => {
  it("explicitly removes inherited Cron Triggers", () => {
    const config = JSON.parse(
      readFileSync(join(process.cwd(), "wrangler.jsonc"), "utf8").replace(/\/\/.*$/gm, ""),
    ) as { triggers?: { crons?: string[] } };

    expect(config.triggers?.crons).toEqual([]);
  });
});
