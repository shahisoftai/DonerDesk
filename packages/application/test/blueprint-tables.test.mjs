import test from "node:test";
import assert from "node:assert/strict";
import { deterministicBlueprintTable } from "../dist/index.js";
import { blueprintSectionsFor } from "@donordesk/domain";

test("activity participants table is built from the recorded numbers", () => {
  const md = deterministicBlueprintTable("bp:activity:participants", [
    { activityId: "a1", activityTitle: "Training | day 1", participantsTotal: 38, participantsMale: 10, participantsFemale: 28 },
    { activityId: "a2", activityTitle: "Outreach", participantsTotal: 600, participantsChildren: 540 },
  ]);
  const lines = md.split("\n");
  assert.equal(lines.length, 4);
  assert.equal(lines[2], "| Training \\| day 1 | 38 | 10 | 28 | — | — |");
  assert.equal(lines[3], "| Outreach | 600 | — | — | 540 | — |");
});

test("no deterministic table for other sections or without activities", () => {
  assert.equal(deterministicBlueprintTable("bp:activity:next", [{ activityId: "a", activityTitle: "x" }]), undefined);
  assert.equal(deterministicBlueprintTable("bp:activity:participants", []), undefined);
  assert.equal(deterministicBlueprintTable(undefined, []), undefined);
});

test("blueprint titles never trip the AI worker's executive-summary classifier", () => {
  for (const reportType of ["MONTHLY", "ACTIVITY", "SITUATION", "CUSTOM"]) {
    const titles = blueprintSectionsFor({ reportType, scope: { sequence: 2 }, activities: [{ id: "a", title: "Water point repair" }] }).map((s) => s.title);
    assert.ok(!titles.some((t) => /overview|abstract/i.test(t)), `${reportType}: ${titles.join(", ")}`);
  }
});
