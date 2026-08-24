import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("ConfidentialMockUSDC", function () {
  let deployer: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;

  before(async function () {
    const signers = await ethers.getSigners();
    [deployer, alice, bob] = signers;
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

    const ConfidentialMockUSDC = await ethers.getContractFactory("ConfidentialMockUSDC");
    const confidentialUsdc = await ConfidentialMockUSDC.deploy(await usdc.getAddress());
    await confidentialUsdc.waitForDeployment();

    return {
      usdc,
      confidentialUsdc,
      confidentialUsdcAddress: await confidentialUsdc.getAddress(),
    };
  }

  it("wraps faucet USDC into an encrypted ERC-7984 balance", async function () {
    const { usdc, confidentialUsdc, confidentialUsdcAddress } = await deployFixture();

    await usdc.connect(alice).faucet(alice.address, 1_000_000n);
    await usdc.connect(alice).approve(confidentialUsdcAddress, 1_000_000n);
    await confidentialUsdc.connect(alice).wrap(alice.address, 1_000_000n);

    const encryptedBalance = await confidentialUsdc.confidentialBalanceOf(alice.address);
    const clearBalance = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedBalance,
      confidentialUsdcAddress,
      alice,
    );

    expect(clearBalance).to.equal(1_000_000n);
  });

  it("keeps confidential transfers decryptable only by authorized users", async function () {
    const { usdc, confidentialUsdc, confidentialUsdcAddress } = await deployFixture();

    await usdc.connect(alice).faucet(alice.address, 1_000_000n);
    await usdc.connect(alice).approve(confidentialUsdcAddress, 1_000_000n);
    await confidentialUsdc.connect(alice).wrap(alice.address, 1_000_000n);

    const encryptedTransfer = await fhevm
      .createEncryptedInput(confidentialUsdcAddress, alice.address)
      .add64(250_000n)
      .encrypt();

    await confidentialUsdc
      .connect(alice)
      ["confidentialTransfer(address,bytes32,bytes)"](bob.address, encryptedTransfer.handles[0], encryptedTransfer.inputProof);

    const encryptedAliceBalance = await confidentialUsdc.confidentialBalanceOf(alice.address);
    const encryptedBobBalance = await confidentialUsdc.confidentialBalanceOf(bob.address);

    const clearAliceBalance = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedAliceBalance,
      confidentialUsdcAddress,
      alice,
    );
    const clearBobBalance = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedBobBalance,
      confidentialUsdcAddress,
      bob,
    );

    await expect(
      fhevm.userDecryptEuint(FhevmType.euint64, encryptedBobBalance, confidentialUsdcAddress, alice),
    ).to.be.rejected;
    expect(clearAliceBalance).to.equal(750_000n);
    expect(clearBobBalance).to.equal(250_000n);
  });
});
