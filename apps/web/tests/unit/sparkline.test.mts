import { test } from "node:test";
import assert from "node:assert/strict";
import { segmentPath, sparkSegments } from "../../src/features/dashboards/domain/sparkline.ts";

test("a missing value breaks the line instead of dropping to zero", () => {
  const segs = sparkSegments([1, 2, null, 4], 100, 20);
  assert.equal(segs.length, 2);
  assert.equal(segs[0]!.points.length, 2);
  assert.equal(segs[1]!.points.length, 1);
});
test("highest is at the top, one value is level, nothing recorded gives no line", () => {
  const [seg] = sparkSegments([0, 10], 100, 20, 2);
  assert.ok(seg!.points[1]![1] < seg!.points[0]![1]);
  assert.equal(sparkSegments([5], 100, 20)[0]!.points[0]![1], 10);
  assert.deepEqual(sparkSegments([null, null], 100, 20), []);
  assert.deepEqual(sparkSegments([], 100, 20), []);
  assert.match(segmentPath(seg!), /^M2 18 L98 2$/);
});
