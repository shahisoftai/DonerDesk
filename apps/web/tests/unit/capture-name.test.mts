import { test } from "node:test";
import assert from "node:assert/strict";
import { captureFileName } from "../../src/lib/shared/capture-name.ts";

test("a captured photo is named from when it was taken, with the right extension", () => {
  const at = new Date("2027-03-12T14:15:02Z");
  assert.equal(captureFileName(at, "image/jpeg"), "photo-20270312-141502.jpg");
  assert.equal(captureFileName(at, "image/png"), "photo-20270312-141502.png");
  assert.equal(captureFileName(at, "image/heic"), "photo-20270312-141502.heic");
  assert.equal(captureFileName(at, ""), "photo-20270312-141502.jpg");
});

test("several photos taken in one go stay distinct", () => {
  const at = new Date("2027-03-12T14:15:02Z");
  assert.deepEqual([0, 1, 2].map((i) => captureFileName(at, "image/jpeg", i)), ["photo-20270312-141502.jpg", "photo-20270312-141502-2.jpg", "photo-20270312-141502-3.jpg"]);
});
