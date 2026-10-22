import { test } from "node:test";
import assert from "node:assert/strict";
import { ROLES, capabilitiesForRole } from "../../src/lib/shared/capabilities.ts";
import { ROLE_NAVIGATION, NAV_ENTRIES, navFor, homeVariantFor } from "../../src/features/navigation/domain/role-navigation.ts";
import { needsYouItems, healthCounts, upcomingReports, homeHeadline } from "../../src/features/dashboard/domain/home-derive.ts";

test("every role has a navigation row that starts at Home and names real entries", () => {
  for (const role of ROLES) {
    const row = ROLE_NAVIGATION[role];
    assert.ok(row, role);
    assert.equal(row.entries[0], "HOME");
    for (const k of row.entries) assert.ok(NAV_ENTRIES[k], `${role}:${k}`);
  }
});

test("a role never sees an entry its capabilities cannot use", () => {
  for (const role of ROLES) {
    const caps = capabilitiesForRole(role);
    for (const item of navFor({ role, capabilities: caps, external: false })) {
      const entry = Object.values(NAV_ENTRIES).find((e) => e.href === item.href)!;
      if (entry.needs) assert.ok(entry.needs.some((c) => caps.has(c)), `${role}:${item.href}`);
    }
  }
});

test("field officer and viewer lose management entries; admin keeps them", () => {
  const hrefs = (role: string) => navFor({ role, capabilities: capabilitiesForRole(role), external: false }).map((i) => i.href);
  assert.ok(!hrefs("FIELD_OFFICER").includes("/team"));
  assert.ok(!hrefs("FIELD_OFFICER").includes("/portfolio"));
  assert.ok(!hrefs("VIEWER").includes("/settings"));
  assert.ok(hrefs("ADMIN").includes("/team"));
});

test("an outside partner sees only their projects; an unknown role is treated as a viewer", () => {
  assert.deepEqual(navFor({ role: "ADMIN", capabilities: capabilitiesForRole("ADMIN"), external: true }).map((i) => i.href), ["/projects"]);
  assert.equal(homeVariantFor("NOPE"), "DIRECTOR");
  assert.equal(homeVariantFor(null), "DIRECTOR");
});

test("each role lands on the intended Home", () => {
  assert.equal(homeVariantFor("ADMIN"), "DIRECTOR");
  assert.equal(homeVariantFor("PROJECT_MANAGER"), "MANAGER");
  assert.equal(homeVariantFor("ME_OFFICER"), "MANAGER");
  assert.equal(homeVariantFor("FIELD_OFFICER"), "FIELD");
  assert.equal(homeVariantFor("GRANTS_OFFICER"), "GRANTS");
  assert.equal(homeVariantFor("COMPLIANCE_OFFICER"), "COMPLIANCE");
});

test("needs-you leaves out zero and unknown counts and puts overdue reports first", () => {
  const items = needsYouItems({ reportsOverdue: 2, highRisks: 1, risksReviewOverdue: 0, evidenceToReview: null, activitiesToReview: 0, checklistBlockers: 3 });
  assert.deepEqual(items.map((i) => i.key), ["reports-overdue", "serious-risks", "checklist"]);
  assert.equal(homeHeadline([]), "Nothing needs your decision right now.");
});

test("portfolio derivations count bands and order reports by deadline", () => {
  const row = (id: string, band: "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "NO_PLAN", days: number | null) => ({
    projectId: id, title: id, delivery: { band },
    reporting: days === null ? null : { periodId: `p-${id}`, deadline: "2026-11-01", daysUntil: days, readinessScore: 50 },
  });
  const rows = [row("a", "ON_TRACK", 9), row("b", "OFF_TRACK", -2), row("c", "NO_PLAN", null)];
  assert.deepEqual(healthCounts(rows), { onTrack: 1, atRisk: 0, offTrack: 1, noPlan: 1 });
  assert.deepEqual(upcomingReports(rows, 5).map((u) => u.projectId), ["b", "a"]);
});

import { paceReading, pipelineBoard, pipelineStageOf, dateTile } from "../../src/features/dashboard/domain/home-derive.ts";

test("pace: a missing value is never drawn as zero; ahead means within two points of the clock", () => {
  assert.deepEqual(paceReading(null, 60), { value: null, timeElapsed: 60, ahead: null });
  assert.equal(paceReading(58, 60).ahead, true);
  assert.equal(paceReading(50, 60).ahead, false);
  assert.equal(paceReading(140, 60).value, 100);
});

test("pipeline: every status lands in a stage and urgent items come first", () => {
  assert.equal(pipelineStageOf("UNDER_REVIEW"), "IN_REVIEW");
  assert.equal(pipelineStageOf("SOMETHING_NEW"), "DRAFTING");
  const board = pipelineBoard([
    { projectId: "a", projectTitle: "A", periodId: "1", status: "NOT_STARTED", deadline: "2026-11-07", daysUntil: 17 },
    { projectId: "b", projectTitle: "B", periodId: "2", status: "DRAFT_GENERATED", deadline: "2026-10-31", daysUntil: 10 },
  ], 2);
  assert.deepEqual(board[0]!.items.map((i) => i.periodId), ["2", "1"]);
  assert.equal(board[1]!.count, 0);
  assert.deepEqual(dateTile("2026-10-26"), { day: "26", month: "Oct" });
});

import { weeklyDelivery, onTimeShare, mondayOf } from "../../src/features/dashboard/domain/home-derive.ts";

test("weekly delivery: a week is judged only once over; cancelled items are left out; nothing judged is a gap", () => {
  assert.equal(mondayOf("2026-10-21"), "2026-10-19");
  const rows = [
    { plannedEnd: "2026-10-06", state: "DONE", status: "DONE" },
    { plannedEnd: "2026-10-07", state: "DONE_LATE", status: "DONE" },
    { plannedEnd: "2026-10-08", state: "CANCELLED", status: "CANCELLED" },
    { plannedEnd: "2026-10-20", state: "IN_PROGRESS", status: "IN_PROGRESS" },
  ];
  const points = weeklyDelivery(rows, "2026-10-21", 3);
  const week = points.find((p) => p.weekStart === "2026-10-05")!;
  assert.equal(week.judged, 2);
  assert.equal(week.percent, 50);
  assert.equal(points.find((p) => p.weekStart === "2026-09-28")!.percent, null);
  assert.equal(onTimeShare(points), 50);
});
