import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer, transformWithEsbuild } from "vite";

// The optional module path is developer-controlled for this local browser harness.
// eslint-disable-next-line no-unsanitized/method
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ?? "playwright"
);
const root = fileURLToPath(new URL("../", import.meta.url));
const harness = `
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { IncreaseUtilization } from '/src/components/IncreaseUtilization.tsx';
import { RepayAllAction } from '/src/components/RepayAllAction.tsx';
import { executeIncreaseUtilization, executeAction } from '/src/protocol/actions.ts';
import { loadLabConfig } from '/src/config.ts';
import '/src/styles.css';
const config = loadLabConfig({});
const params = { loanToken: config.usdc, collateralToken: config.weth,
  oracle: '0x2222222222222222222222222222222222222222', irm: '0x3333333333333333333333333333333333333333', lltv: 900000000000000000n };
let snapshot = {
  blockNumber: 123n, blockTimestamp: 1n, refreshedAt: 1, deployment: config, pool: {},
  adapter: {usdc:config.usdc, confidentialUsdc:config.wrapper, prizePool:config.pool, morpho:config.morpho, marketId:config.marketId, marketParams:params},
  market: {params, oraclePrice:2000n * 10n ** 24n, borrowRatePerSecond:0n, state:{totalSupplyAssets:10000000000n, totalSupplyShares:10000000000000000n, totalBorrowAssets:1000000000n, totalBorrowShares:1000000000000000n,lastUpdate:1n,fee:0n}},
  account: {address:'0x1111111111111111111111111111111111111111',
    position:{supplyShares:0n,borrowShares:500000000000000n,collateralAssets:10n**18n},
    tokens:{wethBalance:10n**18n,ethBalance:10n**18n,usdcBalance:2000000000n,morphoWethAllowance:0n,morphoUsdcAllowance:0n,usdcAllowance:0n,confidentialUsdcHandle:'0x00'}, health:{}, encryptedPrincipalHandle:'0x00',encryptedWinningsHandle:'0x00'}
};
const context = () => ({...config, snapshot, safetyBps:8000n});
const repayMode = location.search === '?repay';
if (repayMode) { snapshot.blockTimestamp=1001n; snapshot.market.borrowRatePerSecond=1000000000000n; }
if (location.search === '?extra') snapshot.account.tokens.wethBalance=2n*10n**18n;
window.testRun = {calls:[], phase:'idle'};
function App() {
  const [view, setView] = useState(context());
  const [busy, setBusy] = useState(false);
  if (repayMode) return <RepayAllAction context={view} disabled={busy} onRun={async (review) => {
    setBusy(true);
    try {
      await executeAction(context(), 'repayUsdc', 'all', {
        refresh:async () => {setView(context()); return context();},
        submit:async (call) => {
          window.testRun.calls.push({name:call.functionName,amount:call.args[1].toString()});
          if(call.functionName==='approve') snapshot={...snapshot,blockTimestamp:1601n,account:{...snapshot.account,tokens:{...snapshot.account.tokens,morphoUsdcAllowance:call.args[1]}}};
          if(call.functionName==='repay') snapshot={...snapshot,account:{...snapshot.account,position:{...snapshot.account.position,borrowShares:0n}}};
        }
      }, review);
      window.testRun.phase='success';
    } catch(error) {window.testRun.phase='failed'; throw error;}
    finally {setBusy(false);}
  }}/>;
  return <IncreaseUtilization context={view} disabled={busy} onRun={async (collateral, borrow) => {
    setBusy(true);
    try {
      await executeIncreaseUtilization(context(), collateral, borrow, {
        refresh:async () => {setView(context()); return context();},
        submit:async (call) => {
          window.testRun.calls.push({name:call.functionName,amount:call.args[1].toString()});
          if(call.functionName==='approve') snapshot={...snapshot,account:{...snapshot.account,tokens:{...snapshot.account.tokens,morphoWethAllowance:collateral}}};
          if(call.functionName==='supplyCollateral') snapshot={...snapshot,account:{...snapshot.account,
            position:{...snapshot.account.position,collateralAssets:snapshot.account.position.collateralAssets+collateral},
            tokens:{...snapshot.account.tokens,wethBalance:snapshot.account.tokens.wethBalance-collateral,morphoWethAllowance:0n}}};
          if(call.functionName==='borrow') {
            window.testRun.phase='borrow';
            await new Promise((resolve,reject) => {window.finishBorrow=(fail) => fail ? reject(new Error('Borrow rejected')) : resolve();});
          }
        }
      });
      window.testRun.phase='success';
    } catch(error) {window.testRun.phase='failed';}
    finally {setBusy(false);}
  }}/>;
}
createRoot(document.getElementById('root')).render(<App/>);
`;
const server = await createServer({
  configFile: false,
  root,
  appType: "custom",
  esbuild: { jsx: "automatic" },
  optimizeDeps: {
    include: ["react", "react-dom/client", "react/jsx-runtime", "viem"],
  },
  server: { host: "127.0.0.1", port: 0 },
  plugins: [
    {
      name: "regression-harness",
      resolveId(id) {
        if (id === "/test-harness.tsx") return "\0test-harness.tsx";
      },
      async load(id) {
        if (id === "\0test-harness.tsx")
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
server.middlewares.use("/__regression", async (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.end(
    // The HTML is a fixed local test harness and contains no untrusted input.
    // eslint-disable-next-line xss/no-mixed-html
    await server.transformIndexHtml(
      "/__regression",
      '<div id="root"></div><script type="module" src="/test-harness.tsx"></script>',
    ),
  );
});
await server.listen();
const browser = await chromium.launch({ headless: true });
try {
  for (const [fail, balance] of [
    [false, 2],
    [true, 2],
    [false, 1],
    [true, 1],
  ]) {
    const page = await browser.newPage({
      viewport: { width: 900, height: 900 },
    });
    const errors = [];
    page.on("console", (message) => {
      if (message.type() === "error") console.error(message.text());
    });
    page.on("response", (response) => {
      if (response.status() >= 400)
        console.error(response.status(), response.url());
    });
    page.on("pageerror", (error) => {
      errors.push(error.message);
      console.error(error.message);
    });
    await page.goto(
      `${server.resolvedUrls.local[0]}__regression${balance === 2 ? "?extra" : ""}`,
    );
    await page.waitForLoadState("networkidle");
    await page.getByLabel("WETH collateral amount", { exact: true }).fill("1");
    assert.equal(
      await page.getByLabel("USDC borrow amount", { exact: true }).inputValue(),
      "2380",
    );
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", {
        name: "Confirm increase utilization",
        exact: true,
      })
      .click();
    await page.waitForFunction(() => window.testRun.phase === "borrow");
    assert.equal(
      await page.getByLabel("USDC borrow amount", { exact: true }).inputValue(),
      "2380",
      "Reviewed borrow must stay frozen after collateral refresh",
    );
    assert.match(
      await page.locator(".action-review").innerText(),
      /supply 1 WETH and borrow 2380 USDC/,
    );
    assert.match(await page.getByRole("list").innerText(), /Borrow 2380 USDC/);
    assert.deepEqual(await page.evaluate(() => window.testRun.calls), [
      { name: "approve", amount: "1000000000000000000" },
      { name: "supplyCollateral", amount: "1000000000000000000" },
      { name: "borrow", amount: "2380000000" },
    ]);
    await page.evaluate((fail) => window.finishBorrow(fail), fail);
    await page.waitForFunction(
      (phase) => window.testRun.phase === phase,
      fail ? "failed" : "success",
    );
    assert.equal(
      await page.getByLabel("USDC borrow amount", { exact: true }).inputValue(),
      "2380",
    );
    assert.match(
      await page.locator(".action-review").innerText(),
      /supply 1 WETH and borrow 2380 USDC/,
    );
    assert.deepEqual(errors, []);
    await page.close();
  }
  const page = await browser.newPage();
  await page.goto(`${server.resolvedUrls.local[0]}__regression?repay`);
  await page.waitForLoadState("networkidle");
  const limit = page.getByLabel("Repayment approval limit (USDC)", {
    exact: true,
  });
  assert.equal(await limit.inputValue(), "505.505253");
  const confirm = page.getByRole("button", {
    name: "Confirm repay all debt",
    exact: true,
  });
  assert.equal(await confirm.isDisabled(), true);
  await limit.fill("500");
  assert.equal(await page.getByRole("checkbox").isDisabled(), true);
  await limit.fill("505.505253");
  await page.getByRole("checkbox").check();
  assert.match(
    await page.locator(".action-review").innerText(),
    /Reviewed approval limit: 505.505253 USDC/,
  );
  await confirm.click();
  await page.waitForFunction(() => window.testRun.phase === "success");
  await page.getByText("No outstanding debt.", { exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.testRun.calls), [
    { name: "approve", amount: "505505253" },
    { name: "repay", amount: "0" },
  ]);
  await page.close();
  console.log(
    "PASS: guided review frozen after collateral supply through success/failure; repay-all shows accrued estimate, requires explicit limit review, rejects insufficient bounds, and submits the reviewed bounded approval.",
  );
} finally {
  await browser.close();
  await server.close();
}
