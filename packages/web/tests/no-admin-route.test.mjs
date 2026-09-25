import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("consumer app has no admin route or navigation item", async () => {
  await assert.rejects(
    access(new URL("../src/app/admin/page.tsx", import.meta.url)),
  );
  // This is a fixed repository-relative test fixture path.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const header = await readFile(
    new URL("../src/components/Header.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(header, /href:\s*["']\/admin["']/);
});
