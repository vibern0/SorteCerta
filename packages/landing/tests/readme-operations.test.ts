import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const landingReadme = join(process.cwd(), "README.md");
const rootReadme = join(process.cwd(), "../../README.md");

function read(path: string): string {
  return readFileSync(path, "utf8");
}

describe("landing operations README", () => {
  it("documents the local operator command flow", () => {
    const markdown = read(landingReadme);

    expect(markdown).toContain("npm install");
    expect(markdown).toContain("npm run landing:dev");
    expect(markdown).toContain("npm run landing:typecheck");
    expect(markdown).toContain("npm run landing:test");
    expect(markdown).toContain("npm run landing:build");
    expect(markdown).toContain(
      "npm exec --workspace @sortecerta/landing wrangler d1 migrations apply sortecerta-landing-local --local",
    );
    expect(markdown).toContain(
      "npm run invitation:create --workspace @sortecerta/landing -- --email person@example.com",
    );
  });

  it("documents production deployment, smoke tests, and rollback", () => {
    const markdown = read(landingReadme);

    expect(markdown).toContain("wrangler d1 create sortecerta-landing");
    expect(markdown).toContain("00000000-0000-0000-0000-000000000000");
    expect(markdown).toContain("wrangler secret put TURNSTILE_SECRET_KEY");
    expect(markdown).toContain("VITE_TURNSTILE_SITE_KEY=");
    expect(markdown).toContain("valid invitation");
    expect(markdown).toContain("invalid invitation");
    expect(markdown).toContain("replay");
    expect(markdown).toContain("previous Worker version");
    expect(markdown).toContain("dropping waitlist data is not a safe rollback");
  });

  it("links from the root README without changing root deployment instructions", () => {
    expect(read(rootReadme)).toContain("[Landing site operations](packages/landing/README.md)");
  });
});
