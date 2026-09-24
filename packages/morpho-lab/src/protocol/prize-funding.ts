import {
  concatHex,
  encodeAbiParameters,
  encodeFunctionData,
  formatUnits,
  getAddress,
  type Address,
  type Hex,
} from "viem";
import {
  confidentialPrizePoolAbi,
  confidentialUsdcAbi,
  erc20Abi,
} from "@sortecerta/protocol";
import type { LabConfig } from "../config";
import type { ProtocolSnapshot } from "../types";
import type { SimulatedWriteArgs } from "../wallet/MetaMaskProvider";
import { createActionContext } from "./actions";

export const prizeFundingAbi = confidentialPrizePoolAbi;
export const fundingWrapperAbi = confidentialUsdcAbi;

type FundingRunner = {
  refresh(): Promise<ProtocolSnapshot>;
  submit(call: SimulatedWriteArgs): Promise<unknown>;
  readFundingSelector(pool: Address): Promise<Hex>;
  encrypt(
    wrapper: Address,
    account: Address,
    amount: bigint
  ): Promise<{ handle: Hex; proof: Hex }>;
  onStep?(message: string): void;
};

export async function executePrizeFunding(
  config: LabConfig,
  account: Address,
  amount: bigint,
  runner: FundingRunner
) {
  const user = getAddress(account);
  if (amount <= 0n || amount >= 2n ** 64n)
    throw new Error("Funding amount is outside the uint64 range.");
  const refresh = async () => {
    const snapshot = await runner.refresh();
    createActionContext(config, snapshot);
    if (!snapshot.account || getAddress(snapshot.account.address) !== user)
      throw new Error("Account changed. Review funding again.");
    if (snapshot.account.tokens.usdcBalance < amount)
      throw new Error("Funding amount exceeds USDC balance.");
    if (snapshot.pool.publicPrizeReserve + amount >= 2n ** 64n)
      throw new Error("Prize reserve exceeds the uint64 range.");
    return snapshot.account.tokens;
  };
  await refresh();
  runner.onStep?.("Preparing prize funding...");
  const selector = await runner.readFundingSelector(getAddress(config.pool));
  if (!/^0x[0-9a-fA-F]{8}$/.test(selector))
    throw new Error("Invalid prize funding selector.");
  const encrypted = await runner.encrypt(
    getAddress(config.wrapper),
    user,
    amount
  );
  const tokens = await refresh();
  if (tokens.usdcAllowance < amount) {
    runner.onStep?.("Approve USDC for the wrapper in MetaMask.");
    await runner.submit({
      address: getAddress(config.usdc),
      abi: erc20Abi,
      functionName: "approve",
      args: [getAddress(config.wrapper), amount],
      summary: `Approve ${formatUnits(amount, 6)} USDC for wrapper`,
    });
  }
  if ((await refresh()).usdcAllowance < amount)
    throw new Error("Wrapper allowance is insufficient. Sequence stopped.");
  const wrap = encodeFunctionData({
    abi: fundingWrapperAbi,
    functionName: "wrap",
    args: [user, amount],
  });
  const transfer = encodeFunctionData({
    abi: fundingWrapperAbi,
    functionName: "confidentialTransferAndCall",
    args: [
      getAddress(config.pool),
      encrypted.handle,
      encrypted.proof,
      concatHex([
        selector,
        encodeAbiParameters([{ type: "uint64" }], [amount]),
      ]),
    ],
  });
  runner.onStep?.("Confirm prize funding in MetaMask.");
  await runner.submit({
    address: getAddress(config.wrapper),
    abi: fundingWrapperAbi,
    functionName: "multicall",
    args: [[wrap, transfer]],
    summary: `Fund prize with ${formatUnits(amount, 6)} USDC`,
  });
  await runner.refresh();
}
