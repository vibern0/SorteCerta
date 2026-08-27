import { ethers } from "hardhat";

const CIRCLE_SEPOLIA_USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const SEPOLIA_MORPHO_BLUE = "0xd011EE229E7459ba1ddd22631eF7bF528d424A14";
const SEPOLIA_WETH = "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9";
const SEPOLIA_USDC_WETH_MARKET_ID = "0x8c561f0929c3a3e2b20fba99c2ae15fc57b4d0599e4371b67c9a58388a27b9d2";

const morphoAbi = [
  "function idToMarketParams(bytes32) view returns (address loanToken,address collateralToken,address oracle,address irm,uint256 lltv)",
];
const prizePoolAbi = ["function setMorphoYieldAdapter(address adapter,uint256 depositBatchSize)"];

async function main() {
  const [deployer] = await ethers.getSigners();
  const usdc = process.env.USDC_ADDRESS ?? process.env.SEPOLIA_USDC_ADDRESS ?? CIRCLE_SEPOLIA_USDC;
  const confidentialUsdc = process.env.CONFIDENTIAL_USDC_ADDRESS;
  const prizePool = process.env.CONFIDENTIAL_PRIZE_POOL_ADDRESS;
  const morpho = process.env.MORPHO_BLUE_ADDRESS ?? SEPOLIA_MORPHO_BLUE;
  const marketId = process.env.MORPHO_MARKET_ID ?? SEPOLIA_USDC_WETH_MARKET_ID;
  const depositBatchSize = BigInt(process.env.MORPHO_DEPOSIT_BATCH_SIZE ?? "4");

  if (!confidentialUsdc || !prizePool) {
    throw new Error("CONFIDENTIAL_USDC_ADDRESS and CONFIDENTIAL_PRIZE_POOL_ADDRESS are required");
  }

  const morphoContract = new ethers.Contract(morpho, morphoAbi, deployer);
  const registeredMarketParams = await morphoContract.idToMarketParams(marketId);
  const marketParams =
    registeredMarketParams.loanToken !== ethers.ZeroAddress
      ? {
          loanToken: registeredMarketParams.loanToken,
          collateralToken: registeredMarketParams.collateralToken,
          oracle: registeredMarketParams.oracle,
          irm: registeredMarketParams.irm,
          lltv: registeredMarketParams.lltv,
        }
      : {
          loanToken: usdc,
          collateralToken: process.env.MORPHO_COLLATERAL_TOKEN ?? SEPOLIA_WETH,
          oracle: process.env.MORPHO_ORACLE_ADDRESS ?? ethers.ZeroAddress,
          irm: process.env.MORPHO_IRM_ADDRESS ?? ethers.ZeroAddress,
          lltv: BigInt(process.env.MORPHO_LLTV ?? "945000000000000000"),
        };

  const MorphoYieldAdapter = await ethers.getContractFactory("MorphoYieldAdapter");
  const adapter = await MorphoYieldAdapter.deploy(usdc, confidentialUsdc, prizePool, morpho, marketParams);
  await adapter.waitForDeployment();
  const adapterAddress = await adapter.getAddress();

  const prizePoolContract = new ethers.Contract(prizePool, prizePoolAbi, deployer);
  const tx = await prizePoolContract.setMorphoYieldAdapter(adapterAddress, depositBatchSize);
  await tx.wait();

  console.log(`Deploying MorphoYieldAdapter with: ${deployer.address}`);
  console.log(`USDC: ${usdc}`);
  console.log(`ConfidentialUSDC: ${confidentialUsdc}`);
  console.log(`ConfidentialPrizePool: ${prizePool}`);
  console.log(`Morpho Blue: ${morpho}`);
  console.log(`MorphoYieldAdapter: ${adapterAddress}`);
  console.log(`Morpho deposit batch size: ${depositBatchSize}`);
  console.log(`Market id: ${await adapter.marketId()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
