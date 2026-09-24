import { ethers } from "hardhat";
import { ZamaSDK, memoryStorage } from "@zama-fhe/sdk";
import { sepolia } from "@zama-fhe/sdk/chains";
import { createConfig } from "@zama-fhe/sdk/ethers";
import { node } from "@zama-fhe/sdk/node";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

async function encryptUint64(contractAddress: string, userAddress: string, amount: bigint) {
  const [signer] = await ethers.getSigners();
  const chain = { ...sepolia, network: process.env.SEPOLIA_RPC_URL! };
  const sdk = new ZamaSDK(createConfig({
    chains: [chain],
    signer,
    storage: memoryStorage,
    relayers: { [chain.id]: node() },
  }));

  try {
    const encrypted = await sdk.encrypt({
      contractAddress: ethers.getAddress(contractAddress) as `0x${string}`,
      userAddress: ethers.getAddress(userAddress) as `0x${string}`,
      values: [{ type: "euint64", value: amount }],
    });
    return {
      handle: encrypted.encryptedValues[0],
      inputProof: encrypted.inputProof,
    };
  } finally {
    sdk.terminate();
  }
}

async function main() {
  if ((await ethers.provider.getNetwork()).chainId !== 11155111n) throw new Error("Sepolia only");
  const [signer] = await ethers.getSigners();
  const poolAddress = ethers.getAddress(process.env.CONFIDENTIAL_PRIZE_POOL_ADDRESS!);
  const pool = await ethers.getContractAt("ConfidentialPrizePool", poolAddress);
  const wrapper = await ethers.getContractAt("ConfidentialUSDC", await pool.token());
  const usdc = new ethers.Contract(await wrapper.underlying(), [
    "function balanceOf(address) view returns(uint256)",
    "function approve(address,uint256) returns(bool)",
  ], signer);
  const file = `cache/withdrawal-smoke-${poolAddress}-${signer.address}.json`;
  const step = process.env.WITHDRAWAL_SMOKE_STEP ?? "status";
  const saved = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  const save = (patch: object) => {
    mkdirSync("cache", { recursive: true });
    Object.assign(saved, patch);
    writeFileSync(file, JSON.stringify(saved, null, 2));
  };
  async function confirmed(tx: any) {
    const receipt = await tx.wait();
    if (receipt.status !== 1) throw new Error("Transaction reverted");
    console.log(JSON.stringify({ step, hash: receipt.hash }));
    return receipt;
  }

  if (step === "deposit") {
    if (saved.deposit) throw new Error("This smoke test already deposited; use request or status");
    const amount = ethers.parseUnits(process.env.WITHDRAWAL_SMOKE_AMOUNT ?? "1", 6);
    const balance = await usdc.balanceOf(signer.address);
    if (amount <= 0n || balance < amount) throw new Error(`Need ${ethers.formatUnits(amount, 6)} USDC at ${signer.address}`);
    const encrypted = await encryptUint64(await wrapper.getAddress(), signer.address, amount);
    await confirmed(await usdc.approve(await wrapper.getAddress(), amount));
    const calls = [
      wrapper.interface.encodeFunctionData("wrap", [signer.address, amount]),
      wrapper.interface.encodeFunctionData("confidentialTransferAndCall(address,bytes32,bytes,bytes)", [poolAddress, encrypted.handle, encrypted.inputProof, "0x"]),
    ];
    save({ amount: amount.toString(), balanceBefore: balance.toString() });
    const receipt = await confirmed(await wrapper.multicall(calls));
    save({ deposit: receipt.hash });
  } else if (step === "request") {
    if (!saved.deposit || saved.request) throw new Error("Deposit first; do not request twice");
    const adapter = await ethers.getContractAt("MorphoYieldAdapter", await pool.morphoYieldAdapter());
    if (await adapter.suppliedPrincipal() < BigInt(saved.amount)) throw new Error("Wait for the Morpho keeper to supply the deposit first");
    const encrypted = await encryptUint64(poolAddress, signer.address, BigInt(saved.amount));
    const receipt = await confirmed(await pool.requestWithdrawal(encrypted.handle, encrypted.inputProof));
    const event = receipt.logs.map((log: any) => {
      try { return pool.interface.parseLog(log); } catch { return undefined; }
    }).find((log: any) => log?.name === "WithdrawalRequested");
    if (!event) throw new Error("Missing withdrawal event");
    save({ request: receipt.hash, batchId: event.args.batchId.toString() });
  } else if (step !== "status") {
    throw new Error("WITHDRAWAL_SMOKE_STEP must be deposit, request, or status");
  }

  const balance = await usdc.balanceOf(signer.address);
  const adapter = await ethers.getContractAt("MorphoYieldAdapter", await pool.morphoYieldAdapter());
  const requestId = saved.batchId ? await pool.withdrawalUnwrapRequest(saved.batchId, signer.address) : ethers.ZeroHash;
  const delivered = requestId !== ethers.ZeroHash && await wrapper.unwrapRequester(requestId) === ethers.ZeroAddress;
  const restored = saved.balanceBefore !== undefined && balance >= BigInt(saved.balanceBefore);
  console.log(JSON.stringify({ account: signer.address, pool: poolAddress, balance: balance.toString(), supplied: (await adapter.suppliedPrincipal()).toString(), ...saved, requestId, delivered, roundTripVerified: delivered && restored }));
  if (delivered && !restored) throw new Error("Delivery finalized but original USDC balance was not restored");
}

main().catch((error) => {
  console.error(error.shortMessage ?? error.message ?? "Withdrawal smoke failed");
  process.exitCode = 1;
});
