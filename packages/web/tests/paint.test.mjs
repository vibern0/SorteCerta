import assert from "node:assert/strict";
import test from "node:test";

import { afterNextPaint } from "../src/lib/paint.ts";

test("waits for the next animation frame before continuing work", async () => {
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  let frameCallback;
  globalThis.requestAnimationFrame = (callback) => {
    frameCallback = callback;
    return 1;
  };

  try {
    let continued = false;
    const waiting = afterNextPaint().then(() => {
      continued = true;
    });

    await Promise.resolve();
    assert.equal(continued, false);

    frameCallback(16);
    await waiting;
    assert.equal(continued, true);
  } finally {
    if (originalRequestAnimationFrame) {
      globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    } else {
      delete globalThis.requestAnimationFrame;
    }
  }
});
