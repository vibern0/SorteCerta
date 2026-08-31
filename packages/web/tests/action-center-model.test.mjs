import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTION_HISTORY_LIMIT,
  addAction,
  dismissAction,
  updateAction,
} from "../src/lib/action-center-model.ts";

const baseAction = {
  label: "Deposit USDC",
  type: "deposit",
  account: "0x1234567890123456789012345678901234567890",
  createdAt: 1_000,
};

test("adds and updates a background action lifecycle", () => {
  const [created] = addAction([], baseAction);

  assert.equal(created.label, "Deposit USDC");
  assert.equal(created.status, "preparing");
  assert.equal(created.updatedAt, baseAction.createdAt);

  const [submitted] = updateAction([created], created.id, {
    status: "submitted",
    txHash: "0xabc",
    updatedAt: 1_500,
  });
  assert.equal(submitted.status, "submitted");
  assert.equal(submitted.txHash, "0xabc");

  const [completed] = updateAction([submitted], created.id, {
    status: "completed",
    updatedAt: 2_000,
  });
  assert.equal(completed.status, "completed");
});

test("keeps only the newest action history records", () => {
  const actions = Array.from({ length: ACTION_HISTORY_LIMIT + 2 }).reduce((current, _, index) => {
    const next = addAction(current, {
      ...baseAction,
      label: `Action ${index}`,
      type: "withdraw",
      createdAt: index,
    });
    return next;
  }, []);

  assert.equal(actions.length, ACTION_HISTORY_LIMIT);
  assert.equal(actions[0].label, `Action ${ACTION_HISTORY_LIMIT + 1}`);
});

test("dismisses only completed or failed actions", () => {
  const actions = addAction([], baseAction);
  const running = actions[0];
  assert.equal(dismissAction(actions, running.id).length, 1);

  const completed = updateAction(actions, running.id, {
    status: "completed",
    updatedAt: 2_000,
  });

  assert.equal(dismissAction(completed, running.id).length, 0);
});
