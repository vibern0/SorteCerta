import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const DRAW_INTERVAL = 5n * 60n;

describe("ConfidentialPrizePool", function () {
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let admin: HardhatEthersSigner;

  before(async function () {
    const signers = await ethers.getSigners();
    admin = signers[0];
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
    const pool = await ConfidentialPrizePool.deploy(confidentialUsdcAddress, DRAW_INTERVAL);
    await pool.waitForDeployment();
    const poolAddress = await pool.getAddress();

    for (const user of [alice, bob]) {
      await usdc.connect(user).faucet(user.address, 10_000_000n);
      await usdc.connect(user).approve(confidentialUsdcAddress, 10_000_000n);
      await confidentialUsdc.connect(user).wrap(user.address, 10_000_000n);
    }

    await usdc.connect(admin).faucet(admin.address, 10_000_000n);
    await usdc.connect(admin).approve(confidentialUsdcAddress, 10_000_000n);
    await confidentialUsdc.connect(admin).wrap(admin.address, 10_000_000n);

    return { usdc, confidentialUsdc, confidentialUsdcAddress, pool, poolAddress };
  }

  async function encryptedDeposit(
    confidentialUsdc: any,
    confidentialUsdcAddress: string,
    poolAddress: string,
    user: HardhatEthersSigner,
    amount: bigint,
    decryptDelegate?: string,
  ) {
    const encryptedAmount = await fhevm
      .createEncryptedInput(confidentialUsdcAddress, user.address)
      .add64(amount)
      .encrypt();
    const data = decryptDelegate
      ? ethers.AbiCoder.defaultAbiCoder().encode(["address"], [decryptDelegate])
      : "0x";

    await confidentialUsdc
      .connect(user)
      ["confidentialTransferAndCall(address,bytes32,bytes,bytes)"](
        poolAddress,
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        data,
      );
  }

  async function fundPrize(
    confidentialUsdc: any,
    confidentialUsdcAddress: string,
    pool: any,
    poolAddress: string,
    amount: bigint,
  ) {
    const encryptedAmount = await fhevm
      .createEncryptedInput(confidentialUsdcAddress, admin.address)
      .add64(amount)
      .encrypt();

    await confidentialUsdc
      .connect(admin)
      ["confidentialTransferAndCall(address,bytes32,bytes,bytes)"](
        poolAddress,
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        await pool.PRIZE_FUNDING_DATA(),
      );
  }

  async function encryptedWrapAndDeposit(
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

    await confidentialUsdc.connect(user).multicall([
      confidentialUsdc.interface.encodeFunctionData("wrap", [user.address, amount]),
      confidentialUsdc.interface.encodeFunctionData("confidentialTransferAndCall(address,bytes32,bytes,bytes)", [
        poolAddress,
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        "0x",
      ]),
    ]);
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

  it("lets an account delegate principal decryption to its owner signer", async function () {
    const { confidentialUsdc, confidentialUsdcAddress, pool, poolAddress } = await deployFixture();

    await encryptedDeposit(confidentialUsdc, confidentialUsdcAddress, poolAddress, alice, 2_000_000n, bob.address);

    const encryptedAlicePrincipal = await pool.encryptedPrincipalOf(alice.address);

    expect(await pool.decryptDelegateOf(alice.address)).to.equal(bob.address);
    expect(await fhevm.userDecryptEuint(FhevmType.euint64, encryptedAlicePrincipal, poolAddress, alice)).to.equal(
      2_000_000n,
    );
    expect(await fhevm.userDecryptEuint(FhevmType.euint64, encryptedAlicePrincipal, poolAddress, bob)).to.equal(
      2_000_000n,
    );
    await expect(fhevm.userDecryptEuint(FhevmType.euint64, encryptedAlicePrincipal, poolAddress, admin)).to.be.rejected;
  });

  it("lets an account set a decrypt delegate after depositing", async function () {
    const { confidentialUsdc, confidentialUsdcAddress, pool, poolAddress } = await deployFixture();

    await encryptedDeposit(confidentialUsdc, confidentialUsdcAddress, poolAddress, alice, 1_250_000n);

    const encryptedAlicePrincipal = await pool.encryptedPrincipalOf(alice.address);
    await expect(fhevm.userDecryptEuint(FhevmType.euint64, encryptedAlicePrincipal, poolAddress, bob)).to.be.rejected;

    await pool.connect(alice).setDecryptDelegate(bob.address);

    expect(await pool.decryptDelegateOf(alice.address)).to.equal(bob.address);
    expect(await fhevm.userDecryptEuint(FhevmType.euint64, encryptedAlicePrincipal, poolAddress, bob)).to.equal(
      1_250_000n,
    );
  });

  it("wraps and deposits in one multicall", async function () {
    const { usdc, confidentialUsdc, confidentialUsdcAddress, pool, poolAddress } = await deployFixture();

    await usdc.connect(alice).faucet(alice.address, 2_500_000n);
    await usdc.connect(alice).approve(confidentialUsdcAddress, 2_500_000n);
    await encryptedWrapAndDeposit(confidentialUsdc, confidentialUsdcAddress, poolAddress, alice, 2_500_000n);

    const encryptedPrincipal = await pool.encryptedPrincipalOf(alice.address);
    const encryptedAliceBalance = await confidentialUsdc.confidentialBalanceOf(alice.address);
    const encryptedPoolBalance = await confidentialUsdc.confidentialBalanceOf(poolAddress);

    expect(await fhevm.userDecryptEuint(FhevmType.euint64, encryptedPrincipal, poolAddress, alice)).to.equal(
      2_500_000n,
    );
    expect(
      await fhevm.userDecryptEuint(FhevmType.euint64, encryptedAliceBalance, confidentialUsdcAddress, alice),
    ).to.equal(10_000_000n);
    expect(await fhevm.debugger.decryptEuint(FhevmType.euint64, encryptedPoolBalance)).to.equal(2_500_000n);
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

  it("withdraws principal into an underlying USDC unwrap request", async function () {
    const { confidentialUsdc, confidentialUsdcAddress, pool, poolAddress } = await deployFixture();

    await encryptedDeposit(confidentialUsdc, confidentialUsdcAddress, poolAddress, alice, 2_000_000n);

    const encryptedAmount = await fhevm.createEncryptedInput(poolAddress, alice.address).add64(1_250_000n).encrypt();
    const tx = await pool.connect(alice).withdrawToUsdc(encryptedAmount.handles[0], encryptedAmount.inputProof, alice.address);
    const receipt = await tx.wait();
    const parsedLogs = receipt?.logs
      .map((log: any) => {
        try {
          return confidentialUsdc.interface.parseLog(log);
        } catch {
          return undefined;
        }
      })
      .filter(Boolean);
    const unwrapRequestId = parsedLogs?.find((log: any) => log.name === "UnwrapRequested")?.args.unwrapRequestId;

    expect(unwrapRequestId).to.not.equal(undefined);
    expect(await confidentialUsdc.unwrapRequester(unwrapRequestId)).to.equal(alice.address);

    const encryptedPrincipal = await pool.encryptedPrincipalOf(alice.address);
    const encryptedPoolBalance = await confidentialUsdc.confidentialBalanceOf(poolAddress);

    expect(await fhevm.userDecryptEuint(FhevmType.euint64, encryptedPrincipal, poolAddress, alice)).to.equal(750_000n);
    expect(await fhevm.debugger.decryptEuint(FhevmType.euint64, encryptedPoolBalance)).to.equal(750_000n);
  });

  it("funds a confidential prize reserve", async function () {
    const { confidentialUsdc, confidentialUsdcAddress, pool, poolAddress } = await deployFixture();

    await fundPrize(confidentialUsdc, confidentialUsdcAddress, pool, poolAddress, 750_000n);

    const encryptedReserve = await pool.encryptedPrizeReserve();
    const encryptedPoolBalance = await confidentialUsdc.confidentialBalanceOf(poolAddress);

    expect(await fhevm.debugger.decryptEuint(FhevmType.euint64, encryptedReserve)).to.equal(750_000n);
    expect(await fhevm.debugger.decryptEuint(FhevmType.euint64, encryptedPoolBalance)).to.equal(750_000n);
  });

  it("runs a confidential weighted draw and lets the winner claim", async function () {
    const { confidentialUsdc, confidentialUsdcAddress, pool, poolAddress } = await deployFixture();

    await encryptedDeposit(confidentialUsdc, confidentialUsdcAddress, poolAddress, alice, 600_000n);
    await encryptedDeposit(confidentialUsdc, confidentialUsdcAddress, poolAddress, bob, 448_576n);
    await fundPrize(confidentialUsdc, confidentialUsdcAddress, pool, poolAddress, 1_000_000n);

    await time.increase(Number(DRAW_INTERVAL) + 1);
    await pool.connect(admin).closeDraw();

    const encryptedAliceWinnings = await pool.encryptedWinningsOf(alice.address);
    const encryptedBobWinnings = await pool.encryptedWinningsOf(bob.address);
    const aliceWinnings = await fhevm.userDecryptEuint(FhevmType.euint64, encryptedAliceWinnings, poolAddress, alice);
    const bobWinnings = await fhevm.userDecryptEuint(FhevmType.euint64, encryptedBobWinnings, poolAddress, bob);

    expect(aliceWinnings + bobWinnings).to.equal(1_000_000n);
    await expect(fhevm.userDecryptEuint(FhevmType.euint64, encryptedBobWinnings, poolAddress, alice)).to.be.rejected;

    const winner = aliceWinnings > 0n ? alice : bob;
    await pool.connect(winner).claimPrize();

    const encryptedClaimedWinnings = await pool.encryptedWinningsOf(winner.address);
    const encryptedWinnerBalance = await confidentialUsdc.confidentialBalanceOf(winner.address);

    expect(await fhevm.userDecryptEuint(FhevmType.euint64, encryptedClaimedWinnings, poolAddress, winner)).to.equal(
      0n,
    );
    expect(
      await fhevm.userDecryptEuint(FhevmType.euint64, encryptedWinnerBalance, confidentialUsdcAddress, winner),
    ).to.be.greaterThan(0n);
  });

  it("exposes the recurring draw schedule and lets anyone close a ready draw", async function () {
    const { pool } = await deployFixture();

    const nextDrawAt = await pool.nextDrawAt();
    expect(await pool.drawInterval()).to.equal(DRAW_INTERVAL);
    await expect(pool.connect(bob).closeDraw()).to.be.revertedWithCustomError(pool, "DrawNotReady");

    await time.increaseTo(nextDrawAt);
    await pool.connect(bob).closeDraw();

    expect(await pool.drawId()).to.equal(1n);
    expect(await pool.nextDrawAt()).to.be.greaterThan(nextDrawAt);
  });
});
