import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const EXTENSIONS = [".ts", ".tsx", ".js", ".mjs"];

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (error?.code !== "ERR_MODULE_NOT_FOUND" || !context.parentURL?.startsWith("file:")) {
      throw error;
    }

    if (!specifier.startsWith(".") && !specifier.startsWith("/")) {
      throw error;
    }

    const resolved = new URL(specifier, context.parentURL);
    for (const extension of EXTENSIONS) {
      const candidate = new URL(`${resolved.href}${extension}`);
      try {
        await access(fileURLToPath(candidate));
        return { shortCircuit: true, url: candidate.href };
      } catch {
        // Keep trying supported source extensions.
      }
    }

    throw error;
  }
}
