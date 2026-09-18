import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import {
  createPublicClient,
  createWalletClient,
  custom,
  encodeAbiParameters,
  getAddress,
  keccak256,
  parseAbiParameters,
} from "viem";
import { sepolia } from "viem/chains";

// External reference/compiler paths keep the app's runtime dependencies unchanged.
const require = createRequire(import.meta.url);
const solc = process.env.SOLC_MODULE
  ? createRequire(process.env.SOLC_MODULE)("./index.js")
  : require("solc");
const reference = resolve(
  process.env.MORPHO_SOURCE ??
    ".superpowers/sdd/2026-09-17-morpho-lab/morpho-blue-reference"
);
assert.match(solc.version(), /^0\.8\.19\+/);
process.env.HARDHAT_CONFIG = fileURLToPath(
  new URL("./hardhat.config.cjs", import.meta.url)
);
const { network } = require("hardhat");
const transport = custom(network.provider);
const client = createPublicClient({ chain: sepolia, transport, cacheTime: 0 });
const [rawAccount] = await network.provider.request({ method: "eth_accounts" });
const account = getAddress(rawAccount);
const wallet = createWalletClient({ account, chain: sepolia, transport });

const fixture = `pragma solidity ^0.8.19;
import {MarketParams, Market} from "src/interfaces/IMorpho.sol";
contract Token {
  mapping(address=>uint256) public balanceOf;
  mapping(address=>mapping(address=>uint256)) public allowance;
  function mint(address to,uint256 amount) external {balanceOf[to]+=amount;}
  function approve(address spender,uint256 amount) external returns(bool){allowance[msg.sender][spender]=amount;return true;}
  function transfer(address to,uint256 amount) external returns(bool){balanceOf[msg.sender]-=amount;balanceOf[to]+=amount;return true;}
  function transferFrom(address from,address to,uint256 amount) external returns(bool){allowance[from][msg.sender]-=amount;balanceOf[from]-=amount;balanceOf[to]+=amount;return true;}
}
contract Rate {
  function borrowRate(MarketParams memory,Market memory) external pure returns(uint256){return 1000000000000;}
  function borrowRateView(MarketParams memory,Market memory) external pure returns(uint256){return 1000000000000;}
}
contract Oracle {function price() external pure returns(uint256){return 2000e24;}}
`;
const output = JSON.parse(
  solc.compile(
    JSON.stringify({
      language: "Solidity",
      sources: {
        "src/Morpho.sol": {
          content: readFileSync(resolve(reference, "src/Morpho.sol"), "utf8"),
        },
        "Fixture.sol": { content: fixture },
      },
      settings: {
        optimizer: { enabled: true, runs: 200 },
        outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
      },
    }),
    {
      import: (path) => ({
        contents: readFileSync(resolve(reference, path), "utf8"),
      }),
    }
  )
);
assert.deepEqual(
  (output.errors ?? []).filter((error) => error.severity === "error"),
  []
);
async function deploy(file, name, args = []) {
  const artifact = output.contracts[file][name];
  const hash = await wallet.deployContract({
    abi: artifact.abi,
    bytecode: `0x${artifact.evm.bytecode.object}`,
    args,
  });
  const receipt = await client.waitForTransactionReceipt({ hash });
  return { address: getAddress(receipt.contractAddress), abi: artifact.abi };
}
async function write(contract, functionName, args) {
  const { request } = await client.simulateContract({
    ...contract,
    functionName,
    args,
    account,
  });
  const hash = await wallet.writeContract(request);
  assert.equal(
    (await client.waitForTransactionReceipt({ hash })).status,
    "success"
  );
}
async function advance(seconds) {
  await network.provider.request({
    method: "evm_increaseTime",
    params: [seconds],
  });
  await network.provider.request({ method: "evm_mine" });
}
const morpho = await deploy("src/Morpho.sol", "Morpho", [account]);
const loan = await deploy("Fixture.sol", "Token");
const weth = await deploy("Fixture.sol", "Token");
const irm = await deploy("Fixture.sol", "Rate");
const oracle = await deploy("Fixture.sol", "Oracle");
const params = {
  loanToken: loan.address,
  collateralToken: weth.address,
  oracle: oracle.address,
  irm: irm.address,
  lltv: 900000000000000000n,
};
const marketId = keccak256(
  encodeAbiParameters(
    parseAbiParameters(
      "(address loanToken,address collateralToken,address oracle,address irm,uint256 lltv)"
    ),
    [params]
  )
);
await write(morpho, "enableIrm", [irm.address]);
await write(morpho, "enableLltv", [params.lltv]);
await write(morpho, "createMarket", [params]);
await write(loan, "mint", [account, 10000_000000n]);
await write(loan, "approve", [morpho.address, 10000_000000n]);
await write(morpho, "supply", [params, 10000_000000n, 0n, account, "0x"]);
await write(weth, "mint", [account, 10n ** 18n]);
await write(weth, "approve", [morpho.address, 10n ** 18n]);
await write(morpho, "supplyCollateral", [params, 10n ** 18n, account, "0x"]);
await write(morpho, "borrow", [params, 500_000000n, 0n, account, account]);
await write(loan, "mint", [account, 100_000000n]);
await advance(3600);

const loader = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  appType: "custom",
});
const {
  createActionContext,
  getRepayAllQuote,
  executeAction,
  buildRepay,
  buildBorrow,
  getActionMax,
  validateAction,
} = await loader.ssrLoadModule("/packages/morpho-lab/src/protocol/actions.ts");
const { loadLabConfig } = await loader.ssrLoadModule(
  "/packages/morpho-lab/src/config.ts"
);
const { morphoReadAbi } = await loader.ssrLoadModule(
  "/packages/morpho-lab/src/abis.ts"
);
await loader.close();
const config = {
  ...loadLabConfig({}),
  morpho: morpho.address,
  usdc: loan.address,
  weth: weth.address,
  marketId,
};
const tokenRead = (functionName, args) =>
  client.readContract({ ...loan, functionName, args });
async function refresh() {
  const block = await client.getBlock();
  const state = await client.readContract({
    address: morpho.address,
    abi: morphoReadAbi,
    functionName: "market",
    args: [marketId],
  });
  const position = await client.readContract({
    address: morpho.address,
    abi: morphoReadAbi,
    functionName: "position",
    args: [marketId, account],
  });
  return createActionContext(config, {
    blockNumber: block.number,
    blockTimestamp: block.timestamp,
    refreshedAt: Date.now(),
    deployment: config,
    adapter: {
      usdc: loan.address,
      confidentialUsdc: config.wrapper,
      prizePool: config.pool,
      morpho: morpho.address,
      marketId,
      marketParams: params,
    },
    market: {
      state,
      params,
      borrowRatePerSecond: 1000000000000n,
      oraclePrice: 2000n * 10n ** 24n,
    },
    account: {
      address: account,
      position: { ...position, collateralAssets: position.collateral },
      tokens: {
        usdcBalance: await tokenRead("balanceOf", [account]),
        morphoUsdcAllowance: await tokenRead("allowance", [
          account,
          morpho.address,
        ]),
      },
    },
  });
}
const initial = await refresh();
const quote = getRepayAllQuote(initial);
assert.ok(quote.estimatedAssets > 500_000000n);
assert.equal(initial.snapshot.market.state.totalBorrowAssets, 500_000000n);
assert.equal(
  getActionMax(initial, "borrowUsdc"),
  1440_000000n - quote.estimatedAssets
);
assert.throws(
  () => validateAction(initial, "borrowUsdc", 940_000000n),
  /safety/i
);
// Morpho itself accepts this amount: it enforces LLTV, not the lab's 80% ceiling.
await client.simulateContract({
  ...buildBorrow(initial, account, 940_000000n),
  account,
});
const oldCollateralMax =
  10n ** 18n - (500_000000n * 10n ** 18n + 1800_000000n - 1n) / 1800_000000n;
assert.ok(getActionMax(initial, "withdrawCollateral") < oldCollateralMax);
assert.throws(
  () => validateAction(initial, "withdrawCollateral", oldCollateralMax),
  /healthy/i
);
const checkpoint = await network.provider.request({ method: "evm_snapshot" });
await write(loan, "approve", [morpho.address, 500_000000n]);
await assert.rejects(
  client.simulateContract({ ...buildRepay(initial, account, "all"), account })
);
await network.provider.request({ method: "evm_revert", params: [checkpoint] });
const review = {
  borrowShares: quote.borrowShares,
  approvalAmount: quote.suggestedApproval,
};
const calls = [];
await advance(300);
await executeAction(
  initial,
  "repayUsdc",
  "all",
  {
    refresh,
    submit: async (call) => {
      calls.push(call.functionName);
      if (call.functionName === "approve")
        assert.equal(call.args[1], review.approvalAmount);
      await write(
        { address: call.address, abi: call.abi },
        call.functionName,
        call.args
      );
      if (call.functionName === "approve") await advance(600);
    },
  },
  review
);
const final = await refresh();
assert.equal(final.snapshot.account.position.borrowShares, 0n);
assert.deepEqual(calls, ["approve", "repay"]);
const spent =
  initial.snapshot.account.tokens.usdcBalance -
  final.snapshot.account.tokens.usdcBalance;
assert.ok(spent > 500_000000n && spent <= review.approvalAmount);
assert.equal(
  final.snapshot.account.tokens.morphoUsdcAllowance,
  review.approvalAmount - spent
);
console.log(
  `PASS: idle interest reduces the lab borrow/collateral limits while Morpho simulation accepts the old borrow limit; real Morpho repayment after 3600s idle + 300s before approval + 600s after approval; stored-amount approval reverts; reviewed limit ${review.approvalAmount}; paid ${spent}; borrowShares=0; no unlimited approval.`
);
await network.provider.request({ method: "hardhat_reset" });
