import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("ConfidentialPrizePool", function () {
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;

  before(async function () {
    const signers = await ethers.getSigners();
    alice = signers[1];
    bob = signers[2];
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      this.skip();
    }
  });

  async function deployFixture() {
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();

    const ConfidentialUSDC = await ethers.getContractFactory("ConfidentialUSDC");
    const confidentialUsdc = await ConfidentialUSDC.deploy(await usdc.getAddress());
    await confidentialUsdc.waitForDeployment();
    const confidentialUsdcAddress = await confidentialUsdc.getAddress();

    const ConfidentialPrizePool = await ethers.getContractFactory("ConfidentialPrizePool");
    const pool = await ConfidentialPrizePool.deploy(confidentialUsdcAddress);
    await pool.waitForDeployment();
    const poolAddress = await pool.getAddress();

    for (const user of [alice, bob]) {
      await usdc.connect(user).faucet(user.address, 10_000_000n);
      await usdc.connect(user).approve(confidentialUsdcAddress, 10_000_000n);
      await confidentialUsdc.connect(user).wrap(user.address, 10_000_000n);
    }

    return { confidentialUsdc, confidentialUsdcAddress, pool, poolAddress };
  }

  async function encryptedDeposit(
    confidentialUsdc: any,
    confidentialUsdcAddress: string,
    poolAddress: string,
    user: HardhatEthersSigner,
    amount: bigint,
  ) {
    const encryptedAmount = await fhevm
      .createEncryptedInput(confidentialUsdcAddress, user.address)
      .add64(amount)
      .encrypt();

    await confidentialUsdc
      .connect(user)
      ["confidentialTransferAndCall(address,bytes32,bytes,bytes)"](
        poolAddress,
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        "0x",
      );
  }

  async function encryptedWithdraw(pool: any, poolAddress: string, user: HardhatEthersSigner, amount: bigint) {
    const encryptedAmount = await fhevm.createEncryptedInput(poolAddress, user.address).add64(amount).encrypt();
    await pool.connect(user).withdraw(encryptedAmount.handles[0], encryptedAmount.inputProof);
  }

  it("tracks encrypted principal for multiple depositors", async function () {
    const { confidentialUsdc, confidentialUsdcAddress, pool, poolAddress } = await deployFixture();

    await encryptedDeposit(confidentialUsdc, confidentialUsdcAddress, poolAddress, alice, 3_000_000n);
    await encryptedDeposit(confidentialUsdc, confidentialUsdcAddress, poolAddress, bob, 1_500_000n);

    const encryptedAlicePrincipal = await pool.encryptedPrincipalOf(alice.address);
    const encryptedBobPrincipal = await pool.encryptedPrincipalOf(bob.address);
    const encryptedTotalPrincipal = await pool.encryptedTotalPrincipal();

    expect(
      await fhevm.userDecryptEuint(FhevmType.euint64, encryptedAlicePrincipal, poolAddress, alice),
    ).to.equal(3_000_000n);
    expect(await fhevm.userDecryptEuint(FhevmType.euint64, encryptedBobPrincipal, poolAddress, bob)).to.equal(
      1_500_000n,
    );
    await expect(fhevm.userDecryptEuint(FhevmType.euint64, encryptedBobPrincipal, poolAddress, alice)).to.be.rejected;
    expect(await fhevm.debugger.decryptEuint(FhevmType.euint64, encryptedTotalPrincipal)).to.equal(4_500_000n);
  });

  it("withdraws principal without exposing the stored balance", async function () {
    const { confidentialUsdc, confidentialUsdcAddress, pool, poolAddress } = await deployFixture();

    await encryptedDeposit(confidentialUsdc, confidentialUsdcAddress, poolAddress, alice, 3_000_000n);
    await encryptedWithdraw(pool, poolAddress, alice, 1_250_000n);

    const encryptedPrincipal = await pool.encryptedPrincipalOf(alice.address);
    const encryptedAliceBalance = await confidentialUsdc.confidentialBalanceOf(alice.address);
    const encryptedPoolBalance = await confidentialUsdc.confidentialBalanceOf(poolAddress);

    expect(await fhevm.userDecryptEuint(FhevmType.euint64, encryptedPrincipal, poolAddress, alice)).to.equal(
      1_750_000n,
    );
    expect(
      await fhevm.userDecryptEuint(FhevmType.euint64, encryptedAliceBalance, confidentialUsdcAddress, alice),
    ).to.equal(8_250_000n);
    expect(await fhevm.debugger.decryptEuint(FhevmType.euint64, encryptedPoolBalance)).to.equal(1_750_000n);
  });

  it("caps withdrawal at encrypted available principal", async function () {
    const { confidentialUsdc, confidentialUsdcAddress, pool, poolAddress } = await deployFixture();

    await encryptedDeposit(confidentialUsdc, confidentialUsdcAddress, poolAddress, alice, 2_000_000n);
    await encryptedWithdraw(pool, poolAddress, alice, 9_000_000n);

    const encryptedPrincipal = await pool.encryptedPrincipalOf(alice.address);
    const encryptedAliceBalance = await confidentialUsdc.confidentialBalanceOf(alice.address);
    const encryptedPoolBalance = await confidentialUsdc.confidentialBalanceOf(poolAddress);

    expect(await fhevm.userDecryptEuint(FhevmType.euint64, encryptedPrincipal, poolAddress, alice)).to.equal(0n);
    expect(
      await fhevm.userDecryptEuint(FhevmType.euint64, encryptedAliceBalance, confidentialUsdcAddress, alice),
    ).to.equal(10_000_000n);
    expect(await fhevm.debugger.decryptEuint(FhevmType.euint64, encryptedPoolBalance)).to.equal(0n);
  });
});
