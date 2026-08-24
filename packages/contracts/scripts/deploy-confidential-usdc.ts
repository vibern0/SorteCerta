import { ethers, network } from "hardhat";

const CIRCLE_SEPOLIA_USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

async function deployLocalMockUSDC() {
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  return usdc.getAddress();
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const chain = await ethers.provider.getNetwork();
  console.log(`Deploying ConfidentialUSDC with: ${deployer.address}`);
  console.log(`Network: ${network.name} (${chain.chainId})`);

  const underlying =
    process.env.SEPOLIA_USDC_ADDRESS ??
    process.env.USDC_ADDRESS ??
    (network.name === "sepolia" ? CIRCLE_SEPOLIA_USDC : await deployLocalMockUSDC());

  const ConfidentialUSDC = await ethers.getContractFactory("ConfidentialUSDC");
  const confidentialUsdc = await ConfidentialUSDC.deploy(underlying);
  await confidentialUsdc.waitForDeployment();

  const confidentialUsdcAddress = await confidentialUsdc.getAddress();

  console.log(`USDC underlying: ${underlying}`);
  console.log(`ConfidentialUSDC: ${confidentialUsdcAddress}`);
  console.log("\nFrontend env vars to set:");
  console.log(`  NEXT_PUBLIC_USDC_ADDRESS=${underlying}`);
  console.log(`  NEXT_PUBLIC_CONFIDENTIAL_USDC_ADDRESS=${confidentialUsdcAddress}`);
  console.log(`  NEXT_PUBLIC_CHAIN_ID=${chain.chainId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
