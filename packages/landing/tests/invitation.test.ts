import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { buildWranglerArgs, generateInvitationCode, hashCodeForStorage } from "../scripts/invitation";

describe("invitation issuer", () => {
  it("formats 128 random bits without reducing entropy", () => {
    const code = generateInvitationCode(Buffer.alloc(16, 0xab));
    expect(code).toBe("SC-ABAB-ABAB-ABAB-ABAB-ABAB-ABAB-ABAB-ABAB");
  });

  it("hashes the normalized code", () => {
    expect(hashCodeForStorage(" sc-abcd efgh ")).toHaveLength(64);
    expect(hashCodeForStorage(" sc-abcd efgh ")).toBe(hashCodeForStorage("SC-ABCDEFGH"));
  });

  it("passes SQL bindings without shell interpolation", () => {
    const args = buildWranglerArgs({
      email: "person@example.com",
      codeHash: "a".repeat(64),
      id: "invite-id",
      createdAt: "2026-09-25T12:00:00.000Z",
      expiresAt: null,
      remote: false,
    });
    expect(args).toContain("--local");
    expect(args.join(" ")).not.toContain("person@example.com');");
  });

  it("loads the CLI under Node's stripped TypeScript runner", () => {
    const result = spawnSync(process.execPath, ["--experimental-strip-types", "scripts/create-invitation.mts"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Usage: npm run invitation:create");
    expect(result.stderr).not.toContain("ERR_MODULE_NOT_FOUND");
  });
});
