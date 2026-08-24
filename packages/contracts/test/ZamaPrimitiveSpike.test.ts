import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("ZamaPrimitiveSpike", function () {
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

  async function deploySpike() {
    const factory = await ethers.getContractFactory("ZamaPrimitiveSpike");
    const spike = await factory.deploy();
    const spikeAddress = await spike.getAddress();

    return { spike, spikeAddress };
  }

  it("lets a user submit and decrypt only their own encrypted value", async function () {
    const { spike, spikeAddress } = await deploySpike();
    const clearValue = 42;

    const encryptedInput = await fhevm
      .createEncryptedInput(spikeAddress, alice.address)
      .add32(clearValue)
      .encrypt();

    const tx = await spike.connect(alice).submitValue(encryptedInput.handles[0], encryptedInput.inputProof);
    await tx.wait();

    const encryptedAliceValue = await spike.getValue(alice.address);
    const decryptedAliceValue = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedAliceValue,
      spikeAddress,
      alice,
    );

    await expect(
      fhevm.userDecryptEuint(FhevmType.euint32, encryptedAliceValue, spikeAddress, bob),
    ).to.be.rejected;
    expect(decryptedAliceValue).to.equal(BigInt(clearValue));
  });

  it("consumes onchain FHE randomness and lets the caller decrypt the result", async function () {
    const { spike, spikeAddress } = await deploySpike();

    const tx = await spike.connect(alice).drawRandomForCaller();
    await tx.wait();

    const encryptedRandom = await spike.getLastRandom();
    const decryptedRandom = await fhevm.userDecryptEuint(FhevmType.euint32, encryptedRandom, spikeAddress, alice);

    expect(decryptedRandom).to.be.lessThan(16n);
  });
});
