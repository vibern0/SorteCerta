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

  it("applies trigger changes after uploading the Worker", () => {
    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    ) as { scripts?: { deploy?: string } };

    expect(packageJson.scripts?.deploy).toContain("wrangler deploy");
    expect(packageJson.scripts?.deploy).toContain("wrangler triggers deploy");
  });
});
