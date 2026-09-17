import assert from "node:assert/strict";
import test from "node:test";

import { getPrizeActions } from "../src/lib/prize-actions.ts";

test("keeps check prize available when a prize can be claimed", () => {
  const actions = getPrizeActions({
    connected: true,
    ready: true,
    busy: false,
    hasPrizeToClaim: true,
    workingAction: undefined,
  });

  assert.deepEqual(
    actions.map((action) => action.id),
    ["checkPrize", "addPrizeToSavings", "claimPrize"],
  );
  assert.equal(actions.find((action) => action.id === "checkPrize")?.label, "Check prize");
});

test("shows only check prize when no claimable prize is known", () => {
  const actions = getPrizeActions({
    connected: true,
    ready: true,
    busy: false,
    hasPrizeToClaim: false,
    workingAction: undefined,
  });

  assert.deepEqual(
    actions.map((action) => action.id),
    ["checkPrize"],
  );
});
