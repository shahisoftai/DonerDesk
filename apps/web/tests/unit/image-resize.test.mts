import test from "node:test";
import assert from "node:assert/strict";
import { planImageResize, smaller, IMAGE_MAX_SIDE } from "../../src/lib/shared/image-resize.ts";

const MB = 1024 * 1024;

test("a big photo is scaled so its long side is 1600, keeping its shape", () => {
  assert.deepEqual(planImageResize({ width: 4000, height: 3000, bytes: 4 * MB, type: "image/jpeg" }), { resize: true, width: 1600, height: 1200 });
  assert.deepEqual(planImageResize({ width: 3000, height: 4000, bytes: 4 * MB, type: "image/jpeg" }), { resize: true, width: 1200, height: 1600 });
});

test("a small file is never redrawn, whatever its dimensions", () => {
  assert.equal(planImageResize({ width: 4000, height: 3000, bytes: 200 * 1024, type: "image/jpeg" }).resize, false);
});

test("a photo already within 1600 px is kept unless it is very large to send", () => {
  assert.equal(planImageResize({ width: 1500, height: 1000, bytes: 900 * 1024, type: "image/jpeg" }).resize, false);
  assert.equal(planImageResize({ width: 1500, height: 1000, bytes: 2 * MB, type: "image/jpeg" }).resize, true);
});

test("only formats a browser can redraw are touched: a PDF or a GIF is left alone", () => {
  for (const type of ["application/pdf", "image/gif", "text/plain"]) assert.equal(planImageResize({ width: 4000, height: 3000, bytes: 9 * MB, type }).resize, false, type);
});

test("bad dimensions keep the original", () => {
  assert.equal(planImageResize({ width: 0, height: 0, bytes: 5 * MB, type: "image/jpeg" }).resize, false);
  assert.equal(planImageResize({ width: Number.NaN, height: 10, bytes: 5 * MB, type: "image/jpeg" }).resize, false);
});

test("the limit is the one the owner chose, and a custom limit works", () => {
  assert.equal(IMAGE_MAX_SIDE, 1600);
  assert.deepEqual(planImageResize({ width: 2000, height: 1000, bytes: 5 * MB, type: "image/png" }, 1000), { resize: true, width: 1000, height: 500 });
});

test("the shrunk copy is kept only when it is really smaller", () => {
  const original = { size: 1000 };
  assert.equal(smaller(original, { size: 400 }).size, 400);
  assert.equal(smaller(original, { size: 1000 }), original);
  assert.equal(smaller(original, { size: 2000 }), original);
  assert.equal(smaller(original, { size: 0 }), original);
  assert.equal(smaller(original, null), original);
});
