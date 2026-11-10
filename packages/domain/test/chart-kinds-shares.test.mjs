import test from "node:test";
import assert from "node:assert/strict";
import { apportion } from "../dist/contexts/reporting/chart-render-kinds-shares.js";
import { waffleCells } from "../dist/contexts/reporting/chart-render.js";

test("apportion always adds to the units and never invents a part", () => {
  for (const values of [[1, 1, 1], [50, 30, 20], [7, 0, 3], [1, 2, 3, 4, 5], [0.1, 0.2, 0.7]]) {
    const cells = apportion(values, 100);
    assert.equal(cells.reduce((a, b) => a + b, 0), 100);
    values.forEach((v, i) => { if (v === 0) assert.equal(cells[i], 0); });
  }
  assert.deepEqual(apportion([0, 0], 100), [0, 0]);
});

test("a tie is broken by position, and the waffle still shares 100 squares the same way", () => {
  assert.deepEqual(apportion([1, 1, 1], 100), [34, 33, 33]);
  assert.deepEqual(waffleCells([1, 1, 1]), [34, 33, 33]);
});
