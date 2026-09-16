import assert from "node:assert/strict";
import test from "node:test";

import { TransactionSender } from "../src/transaction-sender.mjs";

test("simulates before sending and reuses receipts by idempotency key", async () => {
  const calls = [];
  const sender = new TransactionSender({
    simulate: async (request) => calls.push(`simulate:${request.idempotencyKey}`),
    send: async (request) => {
      calls.push(`send:${request.idempotencyKey}`);
      return { hash: `0x${request.idempotencyKey}` };
    },
  });

  const request = { signer: "keeper", idempotencyKey: "abc", to: "0x1", data: "0x" };
  assert.deepEqual(await sender.send(request), { hash: "0xabc" });
  assert.deepEqual(await sender.send(request), { hash: "0xabc" });
  assert.deepEqual(calls, ["simulate:abc", "send:abc"]);
});

test("serializes concurrent transactions for the same signer", async () => {
  const order = [];
  const sender = new TransactionSender({
    simulate: async (request) => order.push(`simulate:${request.idempotencyKey}`),
    send: async (request) => {
      order.push(`send:start:${request.idempotencyKey}`);
      await new Promise((resolve) => setTimeout(resolve, request.idempotencyKey === "a" ? 20 : 0));
      order.push(`send:end:${request.idempotencyKey}`);
      return { hash: `0x${request.idempotencyKey}` };
    },
  });

  await Promise.all([
    sender.send({ signer: "keeper", idempotencyKey: "a", to: "0x1", data: "0x" }),
    sender.send({ signer: "keeper", idempotencyKey: "b", to: "0x1", data: "0x" }),
  ]);

  assert.deepEqual(order, ["simulate:a", "send:start:a", "send:end:a", "simulate:b", "send:start:b", "send:end:b"]);
});
