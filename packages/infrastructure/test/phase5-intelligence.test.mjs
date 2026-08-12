import assert from "node:assert/strict";
import test from "node:test";
import { LessonsLearnedMiner } from "../dist/analytics/lessons-learned-miner.js";

test("lessons mining never combines tenants or sector/donor scopes", () => {
  const update = (tenantId, projectId) => ({
    id: `${tenantId}-${projectId}`,
    tenantId,
    projectId,
    challenges: "A recurring transport challenge caused a delay",
    lessonsLearned: "",
    achievements: "",
    sector: "WASH",
    donorName: "Donor A",
    activityDate: new Date("2026-01-01"),
  });
  const patterns = LessonsLearnedMiner.mineFromActivityUpdates([
    update("tenant-a", "a1"),
    update("tenant-a", "a2"),
    update("tenant-b", "b1"),
    update("tenant-b", "b2"),
  ]);
  assert.equal(patterns.length, 2);
  assert.deepEqual(new Set(patterns.map((pattern) => pattern.tenantId)), new Set(["tenant-a", "tenant-b"]));
  assert.notEqual(patterns[0].id, patterns[1].id);
});
