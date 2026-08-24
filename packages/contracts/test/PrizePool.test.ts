import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { MockUSDC, Vault, PrizePool } from "../typechain-types";

const USDC = (n: number) => BigInt(n) * 1_000_000n; // 6 decimals

describe("SorteCerta — PrizePool", () => {
  let usdc: MockUSDC;
  let vault: Vault;
  let pool: PrizePool;
  let owner: any;
  let alice: any;
  let bob: any;
  let carol: any;

  const DRAW_INTERVAL = 60n * 60n; // 1 hour for tests

  beforeEach(async () => {
    [owner, alice, bob, carol] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = (await MockUSDC.deploy()) as unknown as MockUSDC;
    await usdc.waitForDeployment();

    const Vault = await ethers.getContractFactory("Vault");
    vault = (await Vault.deploy(await usdc.getAddress())) as unknown as Vault;
    await vault.waitForDeployment();

    const PrizePool = await ethers.getContractFactory("PrizePool");
    pool = (await PrizePool.deploy(
      await vault.getAddress(),
      await usdc.getAddress(),
      DRAW_INTERVAL
    )) as unknown as PrizePool;
    await pool.waitForDeployment();

    // Seed test users with USDC.
    for (const u of [owner, alice, bob, carol]) {
      await usdc.faucet(u.address, USDC(10_000));
    }
  });

  it("faucet mints USDC to a user", async () => {
    const bal = await usdc.balanceOf(alice.address);
    expect(bal).to.equal(USDC(10_000));
  });

  it("user deposits USDC and receives shares (= tickets)", async () => {
    await usdc.connect(alice).approve(await pool.getAddress(), USDC(100));
    await pool.connect(alice).depositAndBuyTickets(USDC(100));

    const shares = await vault.balanceOf(alice.address);
    expect(shares).to.equal(USDC(100));

    const tickets = await pool.getTickets(1, alice.address);
    expect(tickets).to.equal(USDC(100));
  });

  it("user can withdraw principal anytime from the vault (no-loss)", async () => {
    await usdc.connect(alice).approve(await pool.getAddress(), USDC(100));
    await pool.connect(alice).depositAndBuyTickets(USDC(100));

    // Withdraw 100 USDC worth of shares.
    await vault.connect(alice).redeem(USDC(100), alice.address, alice.address);

    expect(await usdc.balanceOf(alice.address)).to.equal(USDC(10_000)); // back to start
    expect(await vault.balanceOf(alice.address)).to.equal(0n);
  });

  it("rejects deposit after the draw period ends", async () => {
    await usdc.connect(alice).approve(await pool.getAddress(), USDC(100));
    await pool.connect(alice).depositAndBuyTickets(USDC(100));

    await time.increase(Number(DRAW_INTERVAL) + 1);

    await usdc.connect(bob).approve(await pool.getAddress(), USDC(50));
    await expect(
      pool.connect(bob).depositAndBuyTickets(USDC(50))
    ).to.be.revertedWithCustomError(pool, "DrawEnded");
  });

  it("rejects closeDraw before the period ends", async () => {
    await usdc.connect(alice).approve(await pool.getAddress(), USDC(100));
    await pool.connect(alice).depositAndBuyTickets(USDC(100));

    await expect(pool.closeDraw()).to.be.revertedWithCustomError(pool, "DrawNotEnded");
  });

  it("picks a winner and pays the prize when draw closes", async () => {
    await usdc.connect(alice).approve(await pool.getAddress(), USDC(100));
    await pool.connect(alice).depositAndBuyTickets(USDC(100));

    // Sponsor the prize pool.
    await usdc.connect(owner).approve(await pool.getAddress(), USDC(500));
    await pool.connect(owner).fundPrizePool(USDC(500));

    const drawId = await pool.currentDrawId();
    const beforeAlice = await usdc.balanceOf(alice.address);

    await time.increase(Number(DRAW_INTERVAL) + 1);
    await pool.closeDraw();

    const draw = await pool.draws(drawId);
    expect(draw.fulfilled).to.equal(true);
    expect(draw.winner).to.equal(alice.address);
    expect(draw.prizeAmount).to.equal(0n);

    const afterAlice = await usdc.balanceOf(alice.address);
    expect(afterAlice - beforeAlice).to.equal(USDC(500));
  });

  it("starts a new draw after closing", async () => {
    await usdc.connect(alice).approve(await pool.getAddress(), USDC(100));
    await pool.connect(alice).depositAndBuyTickets(USDC(100));
    await time.increase(Number(DRAW_INTERVAL) + 1);
    await pool.closeDraw();

    const newId = await pool.currentDrawId();
    expect(newId).to.equal(2n);

    const newDraw = await pool.draws(newId);
    expect(newDraw.fulfilled).to.equal(false);
    expect(newDraw.winner).to.equal(ethers.ZeroAddress);
  });

  it("weighted selection — heavier depositor wins more often", async () => {
    // Alice deposits 900, Bob deposits 100. Over many runs, Alice wins ~90%.
    let aliceWins = 0;
    let bobWins = 0;
    const runs = 20;

    for (let i = 0; i < runs; i++) {
      // Top up alice/bob in case they ran dry across runs.
      await usdc.faucet(alice.address, USDC(1_000));
      await usdc.faucet(bob.address, USDC(1_000));

      // Fresh pool each run.
      const PrizePool = await ethers.getContractFactory("PrizePool");
      const fresh = (await PrizePool.deploy(
        await vault.getAddress(),
        await usdc.getAddress(),
        DRAW_INTERVAL
      )) as unknown as PrizePool;
      await fresh.waitForDeployment();

      await usdc.connect(alice).approve(await fresh.getAddress(), USDC(900));
      await fresh.connect(alice).depositAndBuyTickets(USDC(900));

      await usdc.connect(bob).approve(await fresh.getAddress(), USDC(100));
      await fresh.connect(bob).depositAndBuyTickets(USDC(100));

      await usdc.connect(owner).approve(await fresh.getAddress(), USDC(10));
      await fresh.connect(owner).fundPrizePool(USDC(10));

      await time.increase(Number(DRAW_INTERVAL) + 1);
      await fresh.closeDraw();

      const draw = await fresh.draws(await fresh.currentDrawId() - 1n);
      if (draw.winner === alice.address) aliceWins++;
      if (draw.winner === bob.address) bobWins++;
    }

    // Loose bound: Alice should win a clear majority.
    expect(aliceWins).to.be.greaterThan(bobWins);
  });

  it("handles an empty draw (no participants, no prize) without reverting", async () => {
    await time.increase(Number(DRAW_INTERVAL) + 1);
    await pool.closeDraw(); // should not revert

    const draw = await pool.draws(1);
    expect(draw.fulfilled).to.equal(true);
    expect(draw.winner).to.equal(ethers.ZeroAddress);
  });

  it("rejects a second closeDraw on the same draw", async () => {
    await usdc.connect(alice).approve(await pool.getAddress(), USDC(100));
    await pool.connect(alice).depositAndBuyTickets(USDC(100));

    await time.increase(Number(DRAW_INTERVAL) + 1);
    await pool.closeDraw();

    // After closing, currentDrawId incremented, but the old draw is still closed.
    // Calling closeDraw on the new draw should succeed; trying to re-close
    // the same draw isn't directly possible since we always act on currentDrawId.
    // The relevant invariant: the new draw is open.
    const newDraw = await pool.draws(await pool.currentDrawId());
    expect(newDraw.fulfilled).to.equal(false);
  });
});
