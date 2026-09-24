import assert from "node:assert/strict";
import test from "node:test";

import { getAddress } from "viem";
import {
  asBigInt,
  decodeMarketParams,
  sameMarketParams,
  tupleValues,
} from "../src/index.ts";

const loan = getAddress("0x1111111111111111111111111111111111111111");
const collateral = getAddress("0x2222222222222222222222222222222222222222");
const oracle = getAddress("0x3333333333333333333333333333333333333333");
const irm = getAddress("0x4444444444444444444444444444444444444444");
const lltv = 945_000_000_000_000_000n;

test("market params decode named and positional tuples to one canonical id", () => {
  const positional = [
    loan.toLowerCase(),
    collateral.toLowerCase(),
    oracle.toLowerCase(),
    irm.toLowerCase(),
    lltv,
  ];
  const named = { loanToken: loan, collateralToken: collateral, oracle, irm, lltv };

  const decodedPosition = decodeMarketParams(positional);
  const decodedNamed = decodeMarketParams(named);
  assert.equal(decodedPosition.id, decodedNamed.id);
  assert.equal(decodedPosition.loanToken, loan);
  assert.equal(sameMarketParams(decodedPosition, decodedNamed), true);
  assert.equal(sameMarketParams(decodedPosition, { ...named, lltv: 1n }), false);
});

test("tuple decoder rejects incomplete and inherited tuple fields", () => {
  assert.throws(
    () => decodeMarketParams([loan, collateral, oracle, irm]),
    /five fields|tuple/i,
  );
  assert.throws(
    () => decodeMarketParams({ loanToken: loan, collateralToken: collateral, oracle, irm }),
    /lltv|tuple/i,
  );
  const inherited = Object.create({ lltv });
  Object.assign(inherited, { loanToken: loan, collateralToken: collateral, oracle, irm });
  assert.throws(() => decodeMarketParams(inherited), /lltv|tuple/i);
});

test("market params reject invalid addresses and unsafe LLTV coercions", () => {
  const base = { loanToken: loan, collateralToken: collateral, oracle, irm, lltv };
  assert.throws(() => decodeMarketParams({ ...base, loanToken: "0x1234" }), /address/i);
  for (const invalid of [-1n, -1, Number.MAX_SAFE_INTEGER + 1, "-1", "01", "1.5"]) {
    assert.throws(() => decodeMarketParams({ ...base, lltv: invalid }), /LLTV|integer/i);
  }
});

test("shared integer and tuple decoders accept only canonical values", () => {
  assert.equal(asBigInt(2n, "value"), 2n);
  assert.equal(asBigInt(2, "value"), 2n);
  assert.equal(asBigInt("2", "value"), 2n);
  assert.deepEqual(tupleValues([1n, 2n], ["one", "two"]), [1n, 2n]);
  assert.deepEqual(tupleValues({ one: 1n, two: 2n }, ["one", "two"]), [1n, 2n]);
});
