import test from "node:test";
import assert from "node:assert/strict";
import { ROLE_PROJECT_STAGES, stagesFor } from "../../src/features/projects/domain/role-project-stages.ts";
import { PROJECT_STAGES, STAGE_KEYS } from "../../src/features/projects/domain/project-stages.ts";

test("every role has a row, every row names real stages, and Home is always in the bar", () => {
  const keys = new Set(PROJECT_STAGES.map((t) => t.key));
  for (const [role, stages] of Object.entries(ROLE_PROJECT_STAGES)) {
    assert.ok(stages.includes("home"), `${role} sees Home`);
    for (const k of stages) assert.ok(keys.has(k), `${role}: ${k} is a stage`);
  }
  assert.deepEqual(PROJECT_STAGES.map((s) => s.key), [...STAGE_KEYS]);
});

test("trimmed stages go under More, never disappear, and the stage you are on stays in the bar", () => {
  const grants = stagesFor(PROJECT_STAGES, "GRANTS_OFFICER", "home");
  assert.ok(grants.shown.some((t) => t.key === "finance"), "grants officers have Finance");
  assert.ok(grants.more.some((t) => t.key === "review"));
  assert.equal(grants.shown.length + grants.more.length, PROJECT_STAGES.length);
  const onReview = stagesFor(PROJECT_STAGES, "GRANTS_OFFICER", "review");
  assert.ok(onReview.shown.some((t) => t.key === "review"), "a page opened by link keeps its stage visible");
  const field = stagesFor(PROJECT_STAGES, "FIELD_OFFICER", "home");
  assert.deepEqual(field.more, []);
  assert.equal(stagesFor(PROJECT_STAGES, "ADMIN", "home").more.length, 0);
  assert.equal(stagesFor(PROJECT_STAGES, null, "home").shown.length, ROLE_PROJECT_STAGES.VIEWER.length, "no role reads as viewer");
});
