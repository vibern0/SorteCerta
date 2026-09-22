import assert from "node:assert/strict";
import test from "node:test";
import { getAddress } from "viem";

import {
  buildCloseDrawRequest,
  buildFinalizeUnwrapRequest,
  confidentialPrizePoolAbi,
  confidentialUsdcAbi,
} from "../src/index.ts";

test("close draw request checksums the target", () => {
  const pool = "0x1234567890abcdef1234567890abcdef12345678";
  assert.deepEqual(buildCloseDrawRequest(pool), {
    address: getAddress(pool),
    abi: confidentialPrizePoolAbi,
    functionName: "closeDraw",
    args: [],
  });
});

test("finalize unwrap request checksums the target and preserves proof data", () => {
  const wrapper = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
  const requestId = `0x${"ab".repeat(32)}`;
  const proof = "0x1234";
  assert.deepEqual(buildFinalizeUnwrapRequest(wrapper, requestId, 7n, proof), {
    address: getAddress(wrapper),
    abi: confidentialUsdcAbi,
    functionName: "finalizeUnwrap",
    args: [requestId, 7n, proof],
  });
});
