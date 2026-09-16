import { existsSync, readFileSync } from "node:fs";

const KEEPERS = new Map([
  ["morpho", new URL("../../web/netlify/functions/morpho-keeper.ts", import.meta.url)],
  ["withdrawal", new URL("../../web/netlify/functions/withdrawal-keeper.ts", import.meta.url)],
]);

function loadEnvFile(fileUrl) {
  if (!existsSync(fileUrl)) return;

  for (const line of readFileSync(fileUrl, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)?\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;

    const rawValue = match[2] ?? "";
    const value = rawValue.replace(/^(['"])(.*)\1$/, "$2");
    process.env[match[1]] = value;
  }
}

const keeperName = process.argv[2];
const keeperUrl = keeperName ? KEEPERS.get(keeperName) : undefined;

if (!keeperUrl) {
  console.error(`Usage: node packages/keeper/src/run-web-keeper.mjs <${[...KEEPERS.keys()].join("|")}> [--check]`);
  process.exit(1);
}

loadEnvFile(new URL("../../web/.env", import.meta.url));
loadEnvFile(new URL("../../web/.env.local", import.meta.url));

const { default: run } = await import(keeperUrl.href);

if (process.argv.includes("--check")) {
  console.log(`${keeperName} keeper loaded`);
} else {
  await run();
}
