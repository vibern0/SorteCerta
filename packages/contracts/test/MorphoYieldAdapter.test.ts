import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";

const USDC = (n: number) => BigInt(n) * 1_000_000n;
const DRAW_INTERVAL = 5n * 60n;

describe("MorphoYieldAdapter", function () {
  beforeEach(async function () {
    if (!fhevm.isMock) {
      this.skip();
    }
  });

  async function deployFixture() {
    const [owner, keeper] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();

    const ConfidentialUSDC = await ethers.getContractFactory("ConfidentialUSDC");
    const confidentialUsdc = await ConfidentialUSDC.deploy(await usdc.getAddress());
    await confidentialUsdc.waitForDeployment();

    const ConfidentialPrizePool = await ethers.getContractFactory("ConfidentialPrizePool");
    const pool = await ConfidentialPrizePool.deploy(await confidentialUsdc.getAddress(), DRAW_INTERVAL);
    await pool.waitForDeployment();

    const MockMorphoBlue = await ethers.getContractFactory("MockMorphoBlue");
    const morpho = await MockMorphoBlue.deploy();
    await morpho.waitForDeployment();

    const marketParams = {
      loanToken: await usdc.getAddress(),
      collateralToken: keeper.address,
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

    await usdc.faucet(owner.address, USDC(1_500));
    await usdc.faucet(keeper.address, USDC(50));
    await pool.setMorphoYieldAdapter(await adapter.getAddress(), 4);

    return { owner, keeper, usdc, confidentialUsdc, pool, morpho, adapter, marketParams };
  }

  async function encryptedDeposit(
    confidentialUsdc: any,
    confidentialUsdcAddress: string,
    poolAddress: string,
    user: any,
    amount: bigint,
  ) {
    const encryptedAmount = await fhevm.createEncryptedInput(confidentialUsdcAddress, user.address).add64(amount).encrypt();

    await confidentialUsdc
      .connect(user)
      ["confidentialTransferAndCall(address,bytes32,bytes,bytes)"](
        poolAddress,
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        "0x",
      );
  }

  it("batches pool deposits into one principal unwrap request", async function () {
    const { owner, keeper, usdc, confidentialUsdc, pool, adapter } = await deployFixture();
    const users = [owner, keeper];
    const confidentialUsdcAddress = await confidentialUsdc.getAddress();
    const poolAddress = await pool.getAddress();

    for (const user of users) {
      await usdc.connect(user).approve(confidentialUsdcAddress, USDC(4));
      await confidentialUsdc.connect(user).wrap(user.address, USDC(4));
    }

    await encryptedDeposit(confidentialUsdc, confidentialUsdcAddress, poolAddress, owner, USDC(1));
    await encryptedDeposit(confidentialUsdc, confidentialUsdcAddress, poolAddress, keeper, USDC(2));
    await encryptedDeposit(confidentialUsdc, confidentialUsdcAddress, poolAddress, owner, USDC(3));
    const encryptedAmount = await fhevm.createEncryptedInput(confidentialUsdcAddress, keeper.address).add64(USDC(4)).encrypt();
    const tx = await confidentialUsdc
      .connect(keeper)
      ["confidentialTransferAndCall(address,bytes32,bytes,bytes)"](
        poolAddress,
        encryptedAmount.handles[0],
        encryptedAmount.inputProof,
        "0x",
      );
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
    expect(await confidentialUsdc.unwrapRequester(unwrapRequestId)).to.equal(await adapter.getAddress());
    expect(await pool.morphoPendingDepositCount()).to.equal(0n);

    const pending = await pool.encryptedPendingMorphoPrincipal();
    expect(await fhevm.debugger.decryptEuint(FhevmType.euint64, pending)).to.equal(0n);
  });

  it("supplies finalized batch principal to Morpho and can restore it to the pool", async function () {
    const { usdc, confidentialUsdc, pool, adapter } = await deployFixture();

    await usdc.transfer(await adapter.getAddress(), USDC(1_000));
    await pool.supplyFinalizedMorphoPrincipal(USDC(1_000));

    expect(await adapter.suppliedPrincipal()).to.equal(USDC(1_000));
    expect(await adapter.suppliedAssets()).to.equal(USDC(1_000));

    await pool.restoreMorphoPrincipal(USDC(250));

    expect(await adapter.suppliedPrincipal()).to.equal(USDC(750));
    expect(await adapter.suppliedAssets()).to.equal(USDC(750));
    const encryptedPoolBalance = await confidentialUsdc.confidentialBalanceOf(await pool.getAddress());
    expect(await fhevm.debugger.decryptEuint(FhevmType.euint64, encryptedPoolBalance)).to.equal(USDC(250));
  });

  it("harvests Morpho yield and funds the confidential prize reserve", async function () {
    const { keeper, usdc, confidentialUsdc, pool, morpho, adapter, marketParams } = await deployFixture();

    await usdc.transfer(await adapter.getAddress(), USDC(1_000));
    await pool.supplyFinalizedMorphoPrincipal(USDC(1_000));

    await usdc.connect(keeper).approve(await morpho.getAddress(), USDC(50));
    await morpho.connect(keeper).accrueYield(marketParams, USDC(25));

    expect(await adapter.accruedYieldAssets()).to.equal(USDC(25));
    expect(await pool.morphoAccruedYieldAssets()).to.equal(USDC(25));

    await pool.harvestMorphoYield(0);

    const encryptedReserve = await pool.encryptedPrizeReserve();
    const encryptedPoolBalance = await confidentialUsdc.confidentialBalanceOf(await pool.getAddress());

    expect(await pool.publicPrizeReserve()).to.equal(USDC(25));
    expect(await adapter.suppliedPrincipal()).to.equal(USDC(1_000));
    expect(await adapter.accruedYieldAssets()).to.equal(0n);
    expect(await fhevm.debugger.decryptEuint(FhevmType.euint64, encryptedReserve)).to.equal(USDC(25));
    expect(await fhevm.debugger.decryptEuint(FhevmType.euint64, encryptedPoolBalance)).to.equal(USDC(25));
  });

  it("caps harvests and leaves remaining yield in Morpho", async function () {
    const { keeper, usdc, pool, morpho, adapter, marketParams } = await deployFixture();

    await usdc.transfer(await adapter.getAddress(), USDC(1_000));
    await pool.supplyFinalizedMorphoPrincipal(USDC(1_000));

    await usdc.connect(keeper).approve(await morpho.getAddress(), USDC(50));
    await morpho.connect(keeper).accrueYield(marketParams, USDC(50));

    await pool.harvestMorphoYield(USDC(20));

    expect(await pool.publicPrizeReserve()).to.equal(USDC(20));
    expect(await adapter.suppliedPrincipal()).to.equal(USDC(1_000));
    expect(await adapter.accruedYieldAssets()).to.equal(USDC(30));
  });

  it("protects principal and owner controls", async function () {
    const { keeper, usdc, pool, adapter } = await deployFixture();

    await usdc.transfer(await adapter.getAddress(), USDC(100));
    await pool.supplyFinalizedMorphoPrincipal(USDC(100));

    await expect(pool.connect(keeper).supplyFinalizedMorphoPrincipal(USDC(1))).to.be.revertedWithCustomError(
      pool,
      "OnlyOwner",
    );
    await expect(adapter.supplyPoolPrincipal(USDC(1))).to.be.revertedWithCustomError(
      adapter,
      "OnlyPrizePool",
    );
    await expect(pool.restoreMorphoPrincipal(USDC(101))).to.be.revertedWithCustomError(
      adapter,
      "PrincipalWithdrawalExceedsSupply",
    );
    await expect(pool.harvestMorphoYield(0)).to.be.revertedWithCustomError(adapter, "NoAccruedYield");
  });
});
