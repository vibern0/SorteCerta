import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const chain = await ethers.provider.getNetwork();
  console.log(`Deploying ConfidentialPrizePool with: ${deployer.address}`);
  console.log(`Network: ${network.name} (${chain.chainId})`);

  const token = process.env.CONFIDENTIAL_USDC_ADDRESS;
  if (!token) {
    throw new Error("Set CONFIDENTIAL_USDC_ADDRESS to the deployed ERC-7984 USDC wrapper.");
  }

  const ConfidentialPrizePool = await ethers.getContractFactory("ConfidentialPrizePool");
  const pool = await ConfidentialPrizePool.deploy(token);
  await pool.waitForDeployment();

  const poolAddress = await pool.getAddress();

  console.log(`Confidential USDC: ${token}`);
  console.log(`ConfidentialPrizePool: ${poolAddress}`);
  console.log("\nFrontend env vars to set:");
  console.log(`  NEXT_PUBLIC_CONFIDENTIAL_USDC_ADDRESS=${token}`);
  console.log(`  NEXT_PUBLIC_CONFIDENTIAL_PRIZE_POOL_ADDRESS=${poolAddress}`);
  console.log(`  NEXT_PUBLIC_CHAIN_ID=${chain.chainId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
