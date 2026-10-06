import assert from "node:assert/strict";
import test from "node:test";
import { describeReadinessChanges } from "../dist/index.js";

const now = new Date("2026-10-06T12:00:00Z");
const ev = (eventType, hoursAgo) => ({ eventType, createdAt: new Date(now.getTime() - hoursAgo * 3600_000) });

test("recent actions that move readiness are listed newest first, repeats merged, the rest ignored (25.7)", () => {
  const lines = describeReadinessChanges([
    ev("report.section.regenerated", 5), ev("report.section.regenerated", 6), ev("checklist.closed_by_data", 1), ev("login", 0.5), ev("report.approved", 30),
  ], now);
  assert.deepEqual(lines, ["A checklist item closed by itself because the data now satisfies it", "A section was regenerated, so it needs a fresh check (2 times)"]);
});

test("at most five lines; nothing recent gives nothing", () => {
  const many = ["report.section.regenerated", "report.section.approved", "evidence.verified", "checklist.closed_by_data", "report.summary.marked_current", "reporting_period.section_note_saved", "reporting_period.scope_updated"].map((t, i) => ev(t, i + 1));
  assert.equal(describeReadinessChanges(many, now).length, 5);
  assert.deepEqual(describeReadinessChanges([ev("report.approved", 48)], now), []);
});
