import { test } from "node:test";
import assert from "node:assert/strict";
import { FieldReportApplyResponseSchema, FieldReportExtractionResponseSchema } from "../../src/lib/actions/_schemas.ts";

// The API's apply handler returns these counts (ApplyExtractionResult); the web used to read `{ ok }`, so every
// "Add confirmed to report" failed with "unexpected response shape" (demo 5).
test("the apply response the API sends parses", () => {
  const parsed = FieldReportApplyResponseSchema.safeParse({ indicatorsCreated: 2, indicatorsUpdated: 1, activitiesCreated: 0, sectionNotesSaved: 1, errors: [] });
  assert.equal(parsed.success, true);
  assert.equal(FieldReportApplyResponseSchema.safeParse({ indicatorsCreated: 2, indicatorsUpdated: 1, activitiesCreated: 0, errors: [] }).success, true, "an older server without section notes");
});

test("the proposal the API sends parses, with and without section statements", () => {
  const base = { indicatorAchievements: [{ indicatorCode: "OUT-1", value: "30", certainty: "FOUND", excerpt: "OUT-1 30" }], activities: [], story: [{ field: "lessons", text: "x", certainty: "SUGGESTED" }] };
  assert.equal(FieldReportExtractionResponseSchema.safeParse(base).success, true);
  assert.equal(FieldReportExtractionResponseSchema.safeParse({ ...base, sectionNotes: [{ key: "env", title: "Environmental Compliance", text: "Waste sorted." }] }).success, true);
});
