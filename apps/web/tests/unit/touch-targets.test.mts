import test from "node:test";
import assert from "node:assert/strict";
import { TOUCH, TOUCH_MIN_PX, TOUCH_PRIMARY_PX } from "../../src/components/ui/touch.ts";

test("the touch floor is 44 px and the main action 52 px", () => {
  assert.equal(TOUCH_MIN_PX, 44);
  assert.equal(TOUCH_PRIMARY_PX, 52);
});

test("the row target class gives 44 px on a phone (min-h-11 = 2.75rem = 44 px)", () => {
  assert.match(TOUCH.row, /\bmin-h-11\b/);
  assert.equal(2.75 * 16, TOUCH_MIN_PX);
});

test("the primary class names the primary height in px", () => {
  assert.match(TOUCH.primary, new RegExp(`min-h-\\[${TOUCH_PRIMARY_PX}px\\]`));
});

test("the inline target adds 14 px above and below a 16 px line: 44 px in all", () => {
  assert.match(TOUCH.inline, /py-3\.5/);
  assert.equal(16 + 2 * 3.5 * 4, TOUCH_MIN_PX);
});
