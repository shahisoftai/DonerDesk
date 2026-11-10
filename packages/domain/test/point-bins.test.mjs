import assert from "node:assert/strict";
import test from "node:test";
import { binPoints, cellDegreesFor, validBBox } from "../dist/index.js";

const grid = (n) => Array.from({ length: n }, (_, i) => ({ lng: 3 + (i % 100) * 0.1, lat: 5 + Math.floor(i / 100) * 0.05, rank: i % 7 === 0 ? 3 : 1 }));

test("bins: few points, or a close view, are sent as points", () => {
  assert.equal(binPoints(grid(10), [0, 0, 20, 20], 5).mode, "POINTS");
  assert.equal(binPoints(grid(6000), [0, 0, 20, 20], 11).mode, "POINTS");
});

test("bins: many points become cells whose counts add up to the points in view; a cell keeps its worst rank", () => {
  const b = binPoints(grid(6000), [0, 0, 20, 20], 5);
  assert.equal(b.mode, "CELLS");
  assert.equal(b.cells.reduce((t, c) => t + c.count, 0), 6000);
  assert.ok(b.cells.every((c) => c.worst === 3));
  assert.deepEqual(binPoints(grid(6000), [0, 0, 20, 20], 5), b);
});

test("bins: points outside the view are counted, never dropped silently", () => {
  const b = binPoints(grid(6000), [0, 0, 5, 20], 5);
  assert.equal(b.inView + b.outside, 6000);
  assert.ok(b.outside > 0);
});

test("bins: cells halve with each zoom step; a box must be a real box", () => {
  assert.equal(cellDegreesFor(4) / 2, cellDegreesFor(5));
  assert.equal(validBBox([10, 0, 5, 1]), false);
  assert.equal(validBBox([-200, 0, 5, 1]), false);
  assert.equal(validBBox([0, 0, 5, 1]), true);
});
