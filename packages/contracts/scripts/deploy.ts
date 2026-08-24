import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with: ${deployer.address}`);
  console.log(`Network: ${network.name}`);

  const drawInterval =
    process.env.DRAW_INTERVAL_SECONDS
      ? BigInt(process.env.DRAW_INTERVAL_SECONDS)
      : 24n * 60n * 60n; // 1 day default

  // 1. MockUSDC
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  const usdcAddr = await usdc.getAddress();
  console.log(`MockUSDC: ${usdcAddr}`);

  // 2. Vault
  const Vault = await ethers.getContractFactory("Vault");
  const vault = await Vault.deploy(usdcAddr);
  await vault.waitForDeployment();
  const vaultAddr = await vault.getAddress();
  console.log(`Vault:   ${vaultAddr}`);

  // 3. PrizePool
  const PrizePool = await ethers.getContractFactory("PrizePool");
  const pool = await PrizePool.deploy(vaultAddr, usdcAddr, drawInterval);
  await pool.waitForDeployment();
  const poolAddr = await pool.getAddress();
  console.log(`PrizePool: ${poolAddr}`);

  console.log(`\nDraw interval: ${drawInterval}s (~${Number(drawInterval) / 3600}h)`);
  console.log(`\nFrontend env vars to set:`);
  console.log(`  NEXT_PUBLIC_USDC_ADDRESS=${usdcAddr}`);
  console.log(`  NEXT_PUBLIC_VAULT_ADDRESS=${vaultAddr}`);
  console.log(`  NEXT_PUBLIC_PRIZE_POOL_ADDRESS=${poolAddr}`);
  console.log(`  NEXT_PUBLIC_CHAIN_ID=${(await ethers.provider.getNetwork()).chainId}`);

  console.log(`\nFund the deployer with some testnet USDC to bootstrap the first draw:`);
  console.log(`  await usdc.faucet(deployer.address, 1_000_000_000n /* 1000 USDC */)`);
  console.log(`  await usdc.approve(poolAddr, ...)`);
  console.log(`  await pool.fundPrizePool(...)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
