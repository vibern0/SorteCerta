import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying ZamaPrimitiveSpike with: ${deployer.address}`);
  console.log(`Network: ${network.name}`);

  const Spike = await ethers.getContractFactory("ZamaPrimitiveSpike");
  const spike = await Spike.deploy();
  await spike.waitForDeployment();

  const spikeAddress = await spike.getAddress();
  const chain = await ethers.provider.getNetwork();

  console.log(`ZamaPrimitiveSpike: ${spikeAddress}`);
  console.log("\nFrontend env vars to set:");
  console.log(`  NEXT_PUBLIC_ZAMA_SPIKE_ADDRESS=${spikeAddress}`);
  console.log(`  NEXT_PUBLIC_CHAIN_ID=${chain.chainId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
