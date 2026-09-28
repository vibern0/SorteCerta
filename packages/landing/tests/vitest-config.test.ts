import { describe, expect, it } from "vitest";
import config from "../vite.config";

describe("browser test discovery", () => {
  it("leaves worker tests to the Cloudflare runner", () => {
    expect(config.test?.exclude).toEqual(
      expect.arrayContaining(["tests/**/*.worker.test.ts", "tests/**/*-worker.test.ts"]),
    );
  });
});
