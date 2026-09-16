import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const DRAW_INTERVAL = 15n * 60n;
const UINT64_MAX = (1n << 64n) - 1n;

describe("ConfidentialPrizePool invariants", function () {
  let alice: HardhatEthersSigner;

  before(async function () {
    [, alice] = await ethers.getSigners();
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      this.skip();
    }
  });

  async function deployHarness() {
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();

    const ConfidentialUSDC = await ethers.getContractFactory("ConfidentialUSDC");
    const confidentialUsdc = await ConfidentialUSDC.deploy(await usdc.getAddress());
    await confidentialUsdc.waitForDeployment();

    const ConfidentialPrizePoolHarness = await ethers.getContractFactory("ConfidentialPrizePoolHarness");
    const pool = await ConfidentialPrizePoolHarness.deploy(await confidentialUsdc.getAddress(), DRAW_INTERVAL);
    await pool.waitForDeployment();

    return { pool, poolAddress: await pool.getAddress() };
  }

  async function scaledTicket(pool: any, poolAddress: string, randomWord: bigint, totalPrincipal: bigint) {
    const encryptedInput = await fhevm
      .createEncryptedInput(poolAddress, alice.address)
      .add64(randomWord)
      .add64(totalPrincipal)
      .encrypt();

    const encryptedTicket = await pool
      .connect(alice)
      .scaledRandomTicket.staticCall(encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.inputProof);

    await pool
      .connect(alice)
      .scaledRandomTicket(encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.inputProof);

    return fhevm.debugger.decryptEuint(FhevmType.euint128, encryptedTicket);
  }

  it("maps boundary random words into the encrypted principal range", async function () {
    const { pool, poolAddress } = await deployHarness();
    const cases: Array<[bigint, bigint, bigint]> = [
      [0n, 1n, 0n],
      [0n, 1_000_000_001n, 0n],
      [1n << 63n, 100n, 50n],
      [UINT64_MAX, 1_000_000_001n, 1_000_000_000n],
      [UINT64_MAX, 32_000_000_000n, 31_999_999_999n],
    ];

    for (const [randomWord, totalPrincipal, expectedTicket] of cases) {
      const ticket = await scaledTicket(pool, poolAddress, randomWord, totalPrincipal);
      expect(ticket).to.equal(expectedTicket);
      expect(ticket).to.be.lessThan(totalPrincipal);
    }
  });

  it("does not reuse the old fixed ticket range as the effective upper bound", async function () {
    const { pool, poolAddress } = await deployHarness();

    expect(await scaledTicket(pool, poolAddress, UINT64_MAX, 1_048_577n)).to.equal(1_048_576n);
  });
});
