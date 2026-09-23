import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer, transformWithEsbuild } from "vite";

// The optional module path is developer-controlled for this local browser harness.
// eslint-disable-next-line no-unsanitized/method
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ?? "playwright"
);
const root = fileURLToPath(new URL("../", import.meta.url));
const reportDirectory = `${root}/../../.superpowers/sdd/2026-09-17-morpho-lab`;
// The path is derived solely from this checked-in test file, not user input.
// eslint-disable-next-line security/detect-non-literal-fs-filename
await mkdir(reportDirectory, { recursive: true });
const harness = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '/src/App.tsx';
import { Metric } from '/src/components/Metric.tsx';
import { OperatorPanel } from '/src/components/OperatorPanel.tsx';
import { MetaMaskProvider } from '/src/wallet/MetaMaskProvider.tsx';
import { loadLabConfig } from '/src/config.ts';
import '/src/styles.css';
const config = loadLabConfig({});
const mode = new URLSearchParams(location.search).get('mode');
if (mode === 'sdk') {
  import('@zama-fhe/relayer-sdk/web').then(async ({initSDK}) => {
    await initSDK(); window.sdkReady = true;
  }).catch(error => { window.sdkError = String(error); });
}
const snapshot = { pool: {drawId: 1n, publicPrizeReserve: 25000000n, nextDrawAt: 1n} };
createRoot(document.getElementById('root')).render(mode === 'config'
  ? <App env={{VITE_MORPHO_ADDRESS:'bad'}}/>
  : <main className="lab-shell"><h1>SorteCerta Morpho Lab</h1><div className="dashboard-grid">
      <dl><Metric label="Market ID" value="0x123" copyValue="0x123"/></dl>
      <MetaMaskProvider config={config}><OperatorPanel config={config} snapshot={snapshot} refresh={async()=>snapshot} stale={false}/></MetaMaskProvider>
    </div></main>);
`;
const server = await createServer({
  root,
  configFile: `${root}/vite.config.ts`,
  appType: "custom",
  esbuild: { jsx: "automatic" },
  server: { host: "127.0.0.1", port: 0 },
  optimizeDeps: {
    include: ["react", "react-dom/client", "react/jsx-runtime", "viem"],
  },
  plugins: [
    {
      name: "final-fix-harness",
      resolveId(id) {
        if (id === "/final-fix-harness.tsx") return "\0final-fix-harness.tsx";
      },
      async load(id) {
        if (id === "\0final-fix-harness.tsx")
          return (
            await transformWithEsbuild(harness, "harness.tsx", {
              loader: "tsx",
              jsx: "automatic",
            })
          ).code;
      },
    },
  ],
});
server.middlewares.use("/__final_fix", async (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.end(
    // The HTML is a fixed local test harness and contains no untrusted input.
    // eslint-disable-next-line xss/no-mixed-html
    await server.transformIndexHtml(
      "/__final_fix",
      '<div id="root"></div><script type="module" src="/final-fix-harness.tsx"></script>',
    ),
  );
});
await server.listen();
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: async () => {
            throw new Error("Clipboard denied");
          },
        },
      });
    });
    await page.goto(`${server.resolvedUrls.local[0]}__final_fix`);
    await page.getByRole("button", { name: "Copy Market ID" }).click();
    await page
      .getByText("Copy failed", { exact: true })
      .waitFor({ timeout: 3000 });
    assert.deepEqual(
      errors,
      [],
      "Clipboard denial must not escape as an unhandled rejection",
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Confirm prize funding" })
        .isDisabled(),
      true,
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      "Funding addresses must not overflow",
    );
    await page.screenshot({
      path: `${reportDirectory}/final-fix-${width}.png`,
      fullPage: true,
    });
    await page.goto(`${server.resolvedUrls.local[0]}__final_fix?mode=config`);
    await page.getByRole("heading", { name: "Configuration error" }).waitFor();
    assert.match(await page.locator("main").innerText(), /\.env\.local/);
    assert.deepEqual(errors, []);
    await page.close();
  }
  const page = await browser.newPage();
  await page.goto(`${server.resolvedUrls.local[0]}__final_fix?mode=sdk`);
  await page.waitForFunction(
    () => window.sdkReady || window.sdkError,
    undefined,
    { timeout: 60000 },
  );
  assert.equal(await page.evaluate(() => window.sdkError), undefined);
  assert.equal(await page.evaluate(() => window.sdkReady), true);
  console.log(
    "PASS: desktop/mobile funding layout, disconnected funding guard, configuration error mount, clipboard rejection, and Zama browser WASM initialization.",
  );
} finally {
  await browser.close();
  await server.close();
}
