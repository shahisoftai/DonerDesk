import test from "node:test";
import assert from "node:assert/strict";
import { neighbourPage } from "../../src/features/canvas/presentation/use-present.ts";

test("the next and previous page stop at the ends and an unknown page starts at the first", () => {
  const ids = ["a", "b", "c"];
  assert.equal(neighbourPage(ids, "a", 1), "b");
  assert.equal(neighbourPage(ids, "c", 1), "c");
  assert.equal(neighbourPage(ids, "a", -1), "a");
  assert.equal(neighbourPage(ids, "c", -1), "b");
  assert.equal(neighbourPage(ids, "zzz", 1), "a");
  assert.equal(neighbourPage([], "x", 1), "x");
});
