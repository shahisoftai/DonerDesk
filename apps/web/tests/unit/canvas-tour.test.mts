import test from "node:test";
import assert from "node:assert/strict";
import { TOUR_STEPS, nextTourStep, previousTourStep, tourSeen } from "../../src/features/canvas/domain/tour.ts";

test("the tour walks its steps in order and stops at both ends", () => {
  assert.equal(nextTourStep(TOUR_STEPS[0]!), TOUR_STEPS[1]);
  assert.equal(nextTourStep(TOUR_STEPS.at(-1)!), null);
  assert.equal(previousTourStep(TOUR_STEPS[0]!), null);
  assert.equal(previousTourStep(TOUR_STEPS[2]!), TOUR_STEPS[1]);
});

test("it is shown only until done, and a storage that cannot be read never shows it", () => {
  assert.equal(tourSeen(() => null), false);
  assert.equal(tourSeen(() => "done"), true);
  assert.equal(tourSeen(() => { throw new Error("blocked"); }), true);
});
