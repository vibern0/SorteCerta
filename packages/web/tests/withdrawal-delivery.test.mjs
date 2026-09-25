import assert from "node:assert/strict";
import test from "node:test";
import { runWithdrawalKeeper } from "../netlify/functions/withdrawal-keeper.ts";

const address = `0x${"1".repeat(40)}`;
const zero = `0x${"0".repeat(40)}`;
const handle = `0x${"2".repeat(64)}`;

function fixture({ stalled = false, reverted = false } = {}) {
  const states = new Map([[1n, { status: 0, claim: true, delivered: false }], [2n, { status: 2, claim: true, delivered: false }]]);
  const writes = [];
  const writeCalls = [];
  let last;
  const options = {
    rpcUrl: "unused", pool: address, account: { address },
    publicClient: {
      async getBlock() { return { timestamp: 1000n }; },
      async readContract({ functionName, args = [] }) {
        const state = states.get(args[0]);
        switch (functionName) {
          case "currentWithdrawalBatchId": return 2n;
          case "token": return address;
          case "withdrawalBatchStatus": return state.status;
          case "withdrawalBatchClosesAt": return 900n;
          case "withdrawalBatchRequestCount": return 1n;
          case "withdrawalAccounts": return [address];
          case "hasWithdrawalClaim": return state.claim;
          case "withdrawalUnwrapRequest": return `0x${args[0].toString().padStart(64, "0")}`;
          case "unwrapRequester": return states.get(BigInt(args[0])).delivered ? zero : address;
          default: return handle;
        }
      },
      async waitForTransactionReceipt() {
        if (reverted) return { status: "reverted" };
        const { functionName, args } = last;
        const state = states.get(BigInt(args[0]));
        if (functionName === "closeWithdrawalBatch") state.status = 1;
        if (functionName === "settleWithdrawalBatch") state.status = 2;
        if (functionName === "processWithdrawal") state.claim = false;
        if (functionName === "finalizeUnwrap") state.delivered = true;
        return { status: "success" };
      },
    },
    walletClient: { async writeContract(call) {
      if (stalled && call.functionName === "settleWithdrawalBatch") throw new Error("Insufficient backing");
      last = call;
      writes.push(call.functionName);
      writeCalls.push(call);
      return handle;
    } },
    async decrypt(handles) { return { clearValues: Object.fromEntries(handles.map((h) => [h, 1n])), decryptionProof: "0x" }; },
  };
  return { states, writes, writeCalls, options };
}

test("keeper confirms every step through wallet delivery and does not repay on rerun", async () => {
  const { states, writes, writeCalls, options } = fixture();
  const result = await (await runWithdrawalKeeper(options)).json();
  assert.equal(result.pending.length, 0);
  assert.equal(states.get(1n).delivered, true);
  assert.equal(states.get(2n).delivered, true);
  assert.deepEqual(writes.slice(0, 4), ["closeWithdrawalBatch", "settleWithdrawalBatch", "processWithdrawal", "finalizeUnwrap"]);
  assert.deepEqual(writeCalls.slice(0, 4).map(({ functionName, args }) => ({ functionName, args })), [
    { functionName: "closeWithdrawalBatch", args: [1n] },
    { functionName: "settleWithdrawalBatch", args: [1n, 1n, 1n, "0x"] },
    { functionName: "processWithdrawal", args: [1n, address] },
    { functionName: "finalizeUnwrap", args: [`0x${"1".padStart(64, "0")}`, 1n, "0x"] },
  ]);
  const count = writes.length;
  await runWithdrawalKeeper(options);
  assert.equal(writes.length, count);
});

test("an unfunded old batch stays pending without preventing another payout", async () => {
  const { states, options } = fixture({ stalled: true });
  const result = await (await runWithdrawalKeeper(options)).json();
  assert.equal(states.get(1n).delivered, false);
  assert.equal(states.get(2n).delivered, true);
  assert.equal(result.pending[0].batchId, "1");
});

test("reverted receipts are not reported as delivered", async () => {
  const { states, options } = fixture({ reverted: true });
  const result = await (await runWithdrawalKeeper(options)).json();
  assert.equal(result.transactions.length, 0);
  assert.equal(result.pending.length, 2);
  assert.equal(states.get(2n).delivered, false);
});

test("a delayed delivery proof retries after restart without claiming twice", async () => {
  const { states, writes, options } = fixture();
  const decrypt = options.decrypt;
  options.decrypt = async (handles) => {
    if (handles.length === 1) throw new Error("Proof not ready");
    return decrypt(handles);
  };
  const first = await (await runWithdrawalKeeper(options)).json();
  assert.equal(first.pending.length, 2);
  assert.equal(states.get(1n).claim, false);
  assert.equal(states.get(1n).delivered, false);
  const payoutCount = writes.filter((name) => name === "processWithdrawal").length;
  options.decrypt = decrypt;
  const second = await (await runWithdrawalKeeper(options)).json();
  assert.equal(second.pending.length, 0);
  assert.equal(states.get(1n).delivered, true);
  assert.equal(writes.filter((name) => name === "processWithdrawal").length, payoutCount);
});
