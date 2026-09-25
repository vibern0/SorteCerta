import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("configuration bootstrap", () => {
  it.each([
    { VITE_MORPHO_ADDRESS: "bad" },
    { VITE_MORPHO_MARKET_ID: "0x12" },
    { VITE_SEPOLIA_RPC_URL: "not-a-url" },
  ])("mounts an actionable error for %j", (env) => {
    const markup = renderToStaticMarkup(<App env={env} />);
    expect(markup).toContain("Configuration error");
    expect(markup).toContain("packages/morpho-lab/.env.local");
    expect(markup).not.toContain("Protocol dashboard");
  });
});
