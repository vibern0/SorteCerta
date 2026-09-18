import assert from "node:assert/strict";
import test from "node:test";

import { getPrizeActions } from "../src/lib/prize-actions.ts";

test("shows only claim choices when a prize can be claimed", () => {
  const actions = getPrizeActions({
    connected: true,
    ready: true,
    busy: false,
    hasPrizeToClaim: true,
    workingAction: undefined,
  });

  assert.deepEqual(
    actions.map((action) => action.id),
    ["addPrizeToSavings", "claimPrize"],
  );
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
