import { publicConfig } from "./runtime-config.ts";

type AccessGateBypassInput = {
  envValue?: string;
  nodeEnv?: string;
};

const truthyEnvValues = new Set(["1", "true", "yes", "on"]);
const falsyEnvValues = new Set(["0", "false", "no", "off"]);

export function shouldBypassAccessGate(input: AccessGateBypassInput = {}) {
  const rawValue =
    input.envValue ??
    publicConfig("NEXT_PUBLIC_BYPASS_ACCESS_GATE", process.env.NEXT_PUBLIC_BYPASS_ACCESS_GATE);
  const normalizedValue = rawValue.trim().toLowerCase();

  if (truthyEnvValues.has(normalizedValue)) return true;
  if (falsyEnvValues.has(normalizedValue)) return false;

  return (input.nodeEnv ?? process.env.NODE_ENV) === "development";
}
