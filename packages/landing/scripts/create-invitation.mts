import { createInvitation } from "./invitation.ts";

const options = parseArgs(process.argv.slice(2));

try {
  const code = await createInvitation(options);
  console.log(code);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Could not create invitation.");
  process.exitCode = 1;
}

function parseArgs(args: string[]): { email: string; expiresAt: string | null; remote: boolean } {
  let email: string | undefined;
  let expiresAt: string | null = null;
  let remote = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--email") {
      email = args[++index];
    } else if (arg === "--expires") {
      expiresAt = args[++index] ?? null;
    } else if (arg === "--remote") {
      remote = true;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!email) {
    throw new Error("Usage: npm run invitation:create -- --email person@example.com [--expires ISO] [--remote]");
  }

  return { email, expiresAt, remote };
}
