import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { normalizeEmail, normalizeInvitationCode } from "../worker/validation";

export type WranglerArgsInput = {
  email: string;
  codeHash: string;
  id: string;
  createdAt: string;
  expiresAt: string | null;
  remote: boolean;
};

type CreateInvitationInput = {
  email: string;
  expiresAt?: string | null;
  remote?: boolean;
};

export function generateInvitationCode(bytes: Uint8Array = randomBytes(16)): string {
  if (bytes.byteLength !== 16) {
    throw new Error("Invitation codes must use exactly 16 random bytes.");
  }
  const hex = Buffer.from(bytes).toString("hex").toUpperCase();
  return `SC-${hex.match(/.{1,4}/g)?.join("-") ?? hex}`;
}

export function hashCodeForStorage(code: string): string {
  return createHash("sha256").update(normalizeInvitationCode(code)).digest("hex");
}

export function buildWranglerArgs(input: WranglerArgsInput): string[] {
  const mode = input.remote ? "--remote" : "--local";
  const sql = [
    "INSERT INTO invitations (id, email_normalized, code_hash, created_at, expires_at, redeemed_at)",
    `VALUES (${sqlLiteral(input.id)}, ${sqlLiteral(input.email)}, ${sqlLiteral(input.codeHash)}, ${sqlLiteral(
      input.createdAt,
    )}, ${input.expiresAt === null ? "NULL" : sqlLiteral(input.expiresAt)}, NULL);`,
  ].join(" ");

  return [
    resolveWranglerBin(),
    "d1",
    "execute",
    "sortecerta-landing-local",
    mode,
    "--command",
    sql,
  ];
}

export async function createInvitation(input: CreateInvitationInput): Promise<string> {
  const email = normalizeEmail(input.email);
  assertEmail(email);
  const expiresAt = normalizeExpiration(input.expiresAt ?? null);
  const code = generateInvitationCode();
  const args = buildWranglerArgs({
    email,
    codeHash: hashCodeForStorage(code),
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    expiresAt,
    remote: input.remote ?? false,
  });

  await runWrangler(args);
  return code;
}

function normalizeExpiration(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  const date = new Date(value);
  if (!Number.isFinite(date.valueOf()) || date <= new Date()) {
    throw new Error("--expires must be a future ISO timestamp.");
  }
  return date.toISOString();
}

function assertEmail(value: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error("--email must be a valid email address.");
  }
}

function runWrangler(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.stdout?.on("data", (chunk) => {
      process.stdout.write(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr.trim() || `Wrangler exited with code ${code ?? "unknown"}.`));
      }
    });
  });
}

function resolveWranglerBin(): string {
  const require = createRequire(import.meta.url);
  const packagePath = require.resolve("wrangler/package.json");
  return join(dirname(packagePath), "bin", "wrangler.js");
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
