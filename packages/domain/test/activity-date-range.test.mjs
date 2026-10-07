import assert from "node:assert/strict";
import test from "node:test";
import { ActivityUpdate } from "../dist/index.js";

const base = { id: "a1", tenantId: "t", projectId: "p", reportingPeriodId: "r", activityTitle: "Outreach clinics", activityDate: new Date("2026-02-01T00:00:00Z"), summary: "Clinics held.", achievements: "32 clinics", challenges: "none", lessonsLearned: "none", nextSteps: "continue", submittedById: "u" };

test("an activity may cover a span: the end date is kept and read back (demo 7)", () => {
  const a = ActivityUpdate.create({ ...base, activityEndDate: new Date("2026-02-28T00:00:00Z") });
  assert.equal(a.activityEndDate?.toISOString().slice(0, 10), "2026-02-28");
  assert.equal(ActivityUpdate.create(base).activityEndDate, undefined);
});

test("the end date may be the same day but never before the start or invalid", () => {
  assert.doesNotThrow(() => ActivityUpdate.create({ ...base, activityEndDate: new Date("2026-02-01T00:00:00Z") }));
  assert.throws(() => ActivityUpdate.create({ ...base, activityEndDate: new Date("2026-01-31T00:00:00Z") }), /cannot be before/);
  assert.throws(() => ActivityUpdate.create({ ...base, activityEndDate: new Date("nope") }), /not a valid date/);
});
