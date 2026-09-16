import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";

const USDC = (n: number) => BigInt(n) * 1_000_000n;
const DRAW_INTERVAL = 15n * 60n;
const MORPHO_UNWRAP_INTERVAL = 5n * 60n;

describe("Withdrawal batches", function () {
  beforeEach(async function () {
    if (!fhevm.isMock) {
      this.skip();
    }
  });

  async function deployFixture() {
    const [owner, alice, bob] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();

    const ConfidentialUSDC = await ethers.getContractFactory("ConfidentialUSDC");
    const confidentialUsdc = await ConfidentialUSDC.deploy(await usdc.getAddress());
    await confidentialUsdc.waitForDeployment();

    const ConfidentialPrizePool = await ethers.getContractFactory("ConfidentialPrizePool");
    const pool = await ConfidentialPrizePool.deploy(await confidentialUsdc.getAddress(), DRAW_INTERVAL);
    await pool.waitForDeployment();

    for (const user of [alice, bob]) {
      await usdc.connect(user).faucet(user.address, USDC(10));
      await usdc.connect(user).approve(await confidentialUsdc.getAddress(), USDC(10));
      await confidentialUsdc.connect(user).wrap(user.address, USDC(10));
    }

    return { owner, alice, bob, usdc, confidentialUsdc, pool };
  }

  async function deployMorphoFixture() {
    const fixture = await deployFixture();
    const { owner, bob, usdc, confidentialUsdc, pool } = fixture;

    const MockMorphoBlue = await ethers.getContractFactory("MockMorphoBlue");
    const morpho = await MockMorphoBlue.deploy();
    await morpho.waitForDeployment();

    const marketParams = {
      loanToken: await usdc.getAddress(),
      collateralToken: bob.address,
      oracle: ethers.ZeroAddress,
      irm: ethers.ZeroAddress,
      lltv: 945_000_000_000_000_000n,
    };
    await morpho.createMarket(marketParams);

    const MorphoYieldAdapter = await ethers.getContractFactory("MorphoYieldAdapter");
    const adapter = await MorphoYieldAdapter.deploy(
      await usdc.getAddress(),
      await confidentialUsdc.getAddress(),
      await pool.getAddress(),
      await morpho.getAddress(),
      marketParams,
    );
    await adapter.waitForDeployment();

    await pool.setMorphoYieldAdapter(await adapter.getAddress(), MORPHO_UNWRAP_INTERVAL);
    await usdc.connect(owner).faucet(owner.address, USDC(10));
    await usdc.connect(owner).transfer(await adapter.getAddress(), USDC(3));
    await pool.supplyAvailableMorphoPrincipal();

    return { ...fixture, morpho, adapter, marketParams };
  }

  async function encryptedDeposit(confidentialUsdc: any, poolAddress: string, user: any, amount: bigint) {
    const encryptedAmount = await fhevm
      .createEncryptedInput(await confidentialUsdc.getAddress(), user.address)
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

  async function requestWithdrawal(pool: any, poolAddress: string, user: any, amount: bigint) {
    const encryptedAmount = await fhevm.createEncryptedInput(poolAddress, user.address).add64(amount).encrypt();
    await pool.connect(user).requestWithdrawal(encryptedAmount.handles[0], encryptedAmount.inputProof);
  }

  it("queues encrypted withdrawal claims and removes them from active principal", async function () {
    const { alice, bob, confidentialUsdc, pool } = await deployFixture();
    const poolAddress = await pool.getAddress();

    await encryptedDeposit(confidentialUsdc, poolAddress, alice, USDC(3));
    await encryptedDeposit(confidentialUsdc, poolAddress, bob, USDC(2));

    await requestWithdrawal(pool, poolAddress, alice, USDC(1));
    await requestWithdrawal(pool, poolAddress, bob, USDC(9));

    const batchId = await pool.currentWithdrawalBatchId();
    expect(batchId).to.equal(1n);
    expect(await pool.withdrawalBatchRequestCount(batchId)).to.equal(2n);

    const alicePrincipal = await pool.encryptedPrincipalOf(alice.address);
    const bobPrincipal = await pool.encryptedPrincipalOf(bob.address);
    const totalPrincipal = await pool.encryptedTotalPrincipal();
    const batchTotal = await pool.encryptedWithdrawalBatchTotal(batchId);

    expect(await fhevm.userDecryptEuint(FhevmType.euint64, alicePrincipal, poolAddress, alice)).to.equal(USDC(2));
    expect(await fhevm.userDecryptEuint(FhevmType.euint64, bobPrincipal, poolAddress, bob)).to.equal(0n);
    expect(await fhevm.debugger.decryptEuint(FhevmType.euint64, totalPrincipal)).to.equal(USDC(2));
    expect(await fhevm.debugger.decryptEuint(FhevmType.euint64, batchTotal)).to.equal(USDC(3));
  });

  it("blocks claims until a queued batch is funded, then pays each encrypted claim once", async function () {
    const { alice, confidentialUsdc, pool } = await deployFixture();
    const poolAddress = await pool.getAddress();

    await encryptedDeposit(confidentialUsdc, poolAddress, alice, USDC(3));
    await requestWithdrawal(pool, poolAddress, alice, USDC(1));

    const batchId = await pool.currentWithdrawalBatchId();
    await expect(pool.connect(alice).claimWithdrawal(batchId)).to.be.revertedWithCustomError(pool, "WithdrawalBatchNotFunded");

    await pool.markWithdrawalBatchFunded(batchId, USDC(1));
    await pool.connect(alice).claimWithdrawal(batchId);

    const aliceBalance = await confidentialUsdc.confidentialBalanceOf(alice.address);
    const aliceClaim = await pool.encryptedWithdrawalClaimOf(batchId, alice.address);

    expect(await fhevm.userDecryptEuint(FhevmType.euint64, aliceBalance, await confidentialUsdc.getAddress(), alice)).to.equal(
      USDC(8),
    );
    expect(await fhevm.debugger.decryptEuint(FhevmType.euint64, aliceClaim)).to.equal(0n);
    await expect(pool.connect(alice).claimWithdrawal(batchId)).to.be.revertedWithCustomError(pool, "NoWithdrawalClaim");
  });

  it("restores queued withdrawal liquidity from Morpho before claims", async function () {
    const { alice, confidentialUsdc, pool, adapter } = await deployMorphoFixture();
    const poolAddress = await pool.getAddress();

    await encryptedDeposit(confidentialUsdc, poolAddress, alice, USDC(3));
    await requestWithdrawal(pool, poolAddress, alice, USDC(2));

    const batchId = await pool.currentWithdrawalBatchId();
    await pool.restoreWithdrawalBatch(batchId, USDC(2));

    expect(await pool.withdrawalBatchFunded(batchId)).to.equal(true);
    expect(await pool.withdrawalBatchRestoredAmount(batchId)).to.equal(USDC(2));
    expect(await adapter.suppliedPrincipal()).to.equal(USDC(1));

    await pool.connect(alice).claimWithdrawal(batchId);

    const aliceBalance = await confidentialUsdc.confidentialBalanceOf(alice.address);
    expect(await fhevm.userDecryptEuint(FhevmType.euint64, aliceBalance, await confidentialUsdc.getAddress(), alice)).to.equal(
      USDC(9),
    );
  });
});
