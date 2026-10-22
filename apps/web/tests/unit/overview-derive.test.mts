import { test } from "node:test";
import assert from "node:assert/strict";
import type { DataSheet } from "../../../../packages/domain/src/contexts/reporting/data-sheet.ts";
import {
  budgetPace,
  calendarItems,
  closeOut,
  headlineIndicator,
  latestPercentOfTarget,
  latestRecordedCell,
  lifecycle,
  movedThisQuarter,
  needsYouItems,
  resultsPace,
  teamsWeek,
} from "../../src/features/projects/domain/overview-derive.ts";

const sheet = (): DataSheet => ({
  projectId: "p1",
  periods: [
    { id: "q1", label: "Q1 2025", start: "2025-01-01", end: "2025-03-31", reportType: "QUARTERLY", locked: false },
    { id: "q2", label: "Q2 2025", start: "2025-04-01", end: "2025-06-30", reportType: "QUARTERLY", locked: false },
  ],
  indicators: [
    { id: "i1", code: "IND-001", name: "Households reached", level: "OUTCOME", type: "NUMBER", baseline: "0", target: "1000", isRate: false },
    { id: "i2", code: "IND-002", name: "Water points functioning", level: "OUTPUT", type: "PERCENTAGE", baseline: "68%", target: "90%", isRate: true },
    { id: "i3", code: "IND-003", name: "Never measured", level: "OUTPUT", type: "NUMBER", baseline: "0", target: "500", isRate: false },
  ],
  cells: [
    { indicatorId: "i1", periodId: "q1", periodValue: "300", cumulativeValue: "300", status: "VERIFIED" },
    { indicatorId: "i1", periodId: "q2", periodValue: "250", cumulativeValue: "550", status: "VERIFIED" },
    { indicatorId: "i2", periodId: "q2", periodValue: "81%", cumulativeValue: "81%", status: "VERIFIED" },
  ],
  finance: [
    { periodId: "q1", currency: "USD", budget: "100", expenditure: "80", balance: "20", burnRatePercent: "80", verified: true },
    { periodId: "q2", currency: "USD", budget: "100", expenditure: "60", balance: "40", burnRatePercent: "60", verified: false },
  ],
});

/* ------------------------------------------------------------------ lifecycle */

test("the lifecycle says which period the programme is in", () => {
  const life = lifecycle({
    startDate: "2025-01-01",
    endDate: "2026-12-31",
    today: "2025-07-01",
    reportingFrequency: "QUARTERLY",
    periods: [
      { reportType: "QUARTERLY", startDate: "2025-01-01", endDate: "2025-03-31" },
      { reportType: "QUARTERLY", startDate: "2025-04-01", endDate: "2025-06-30" },
      { reportType: "QUARTERLY", startDate: "2025-07-01", endDate: "2025-09-30" },
    ],
  });
  // The programme is eight quarters long; we are in the third one, whether or not it exists yet.
  assert.equal(life.currentPeriod, 3);
  assert.equal(life.totalPeriods, 8);
  assert.equal(life.periodUnit, "quarter");
  assert.equal(life.stage, "IMPLEMENTATION");
  assert.equal(life.finalYear, false);
});

test("the period count follows the cadence before any period exists", () => {
  const life = lifecycle({
    startDate: "2025-01-01",
    endDate: "2026-12-31",
    today: "2025-01-05",
    reportingFrequency: "QUARTERLY",
    periods: [],
  });
  assert.equal(life.totalPeriods, 8);
  assert.equal(life.currentPeriod, 1);
});

test("the last six months are the closing year", () => {
  const life = lifecycle({ startDate: "2025-01-01", endDate: "2026-12-31", today: "2026-09-01", periods: [] });
  assert.equal(life.finalYear, true);
  assert.equal(life.stage, "CLOSEOUT");
});

test("time elapsed never leaves 0 to 100", () => {
  const before = lifecycle({ startDate: "2025-06-01", endDate: "2026-06-01", today: "2025-01-01", periods: [] });
  assert.equal(before.timeElapsedPercent, 0);
  assert.equal(before.stage, "SETUP");
  const after = lifecycle({ startDate: "2025-01-01", endDate: "2026-01-01", today: "2027-01-01", periods: [] });
  assert.equal(after.timeElapsedPercent, 100);
  assert.equal(after.stage, "ENDED");
  assert.equal(after.daysRemaining, 0);
});

/* ------------------------------------------------------------------ pace */

test("an indicator that was never measured is absent, never zero", () => {
  const pace = resultsPace(sheet(), 50);
  assert.equal(pace.measured, 1);
  assert.equal(pace.notMeasured, 1);
  assert.equal(latestPercentOfTarget(sheet(), sheet().indicators[2]!), null);
});

test("a rate has no share of target", () => {
  assert.equal(latestPercentOfTarget(sheet(), sheet().indicators[1]!), null);
  const pace = resultsPace(sheet(), 50);
  assert.equal(pace.measured, 1);
});

test("an indicator behind the clock is counted as behind", () => {
  const pace = resultsPace(sheet(), 80);
  assert.equal(pace.measured, 1);
  assert.equal(pace.behind, 1);
  assert.equal(pace.atOrAhead, 0);
  const onPace = resultsPace(sheet(), 50);
  assert.equal(onPace.behind, 0);
  assert.equal(onPace.atOrAhead, 1);
});

test("the money is read per currency and never added together", () => {
  const pace = budgetPace(sheet(), new Map([["q1", "Q1 2025"], ["q2", "Q2 2025"]]));
  assert.equal(pace.length, 1);
  assert.equal(pace[0]!.currency, "USD");
  assert.equal(pace[0]!.budget, 200);
  assert.equal(pace[0]!.expenditure, 140);
  assert.equal(pace[0]!.spentPercent, 70);
  assert.equal(pace[0]!.verifiedThrough, "Q1 2025");
});

/* ------------------------------------------------------------------ headline */

test("the chart draws the highest level with recorded values, and never a rate", () => {
  const headline = headlineIndicator(sheet());
  assert.equal(headline?.indicator.code, "IND-001");
  assert.equal(headline?.series.length, 2);
  assert.equal(headline?.series[1]!.percent, 55);
});

test("nothing recorded means no chart", () => {
  const empty: DataSheet = { ...sheet(), cells: [], indicators: [sheet().indicators[2]!] };
  assert.equal(headlineIndicator(empty), null);
});

/* ------------------------------------------------------------------ calendar */

test("everything due is in one list, overdue first", () => {
  const items = calendarItems({
    today: "2025-07-01",
    projectId: "p1",
    planRows: [{ id: "a1", title: "Seed distribution", plannedEnd: "2025-07-05", status: "PLANNED", signal: "ON_TIME" }],
    periods: [{ id: "q3", reportType: "QUARTERLY", status: "UNDER_REVIEW", deadline: "2025-07-20", daysUntilDeadline: 19, readinessScore: 60 }],
    risks: [{ id: "r1", title: "Road cut", reviewBy: "2025-06-20", status: "OPEN", seriousness: "HIGH" }],
    assignments: [{ key: "k1", kind: "TASK", title: "Share site list", dueDate: "2025-07-10", state: "LATE", href: "/x", projectId: "p1" }],
  });
  assert.equal(items[0]!.overdue, true);
  assert.equal(items[0]!.kind, "RISK_REVIEW");
  const kinds = items.map((item) => item.kind);
  assert.ok(kinds.includes("PLAN"));
  assert.ok(kinds.includes("REPORT"));
  assert.ok(kinds.includes("REQUEST"));
});

test("only this project's own requests are listed", () => {
  const items = calendarItems({
    today: "2025-07-01",
    projectId: "p1",
    planRows: [],
    periods: [],
    risks: [],
    assignments: [{ key: "k1", kind: "TASK", title: "Other project", dueDate: "2025-07-10", state: "OPEN", href: "/x", projectId: "p2" }],
  });
  assert.equal(items.length, 0);
});

test("work that is done or cancelled is not on the calendar", () => {
  const items = calendarItems({
    today: "2025-07-01",
    projectId: "p1",
    planRows: [
      { id: "a1", title: "Finished", plannedEnd: "2025-07-05", status: "DONE", signal: "DONE" },
      { id: "a2", title: "Cancelled", plannedEnd: "2025-07-05", status: "CANCELLED", signal: "CANCELLED" },
    ],
    periods: [],
    risks: [],
    assignments: [],
  });
  assert.equal(items.length, 0);
});

test("planned work is listed once, not again as my assignment", () => {
  const items = calendarItems({
    today: "2025-07-01",
    projectId: "p1",
    meId: "u1",
    planRows: [{ id: "a1", title: "Seed distribution", plannedEnd: "2025-07-05", status: "PLANNED", signal: "ON_TIME", ownerUserId: "u1" }],
    periods: [],
    risks: [],
    assignments: [{ key: "plan:a1", kind: "PLAN_ITEM", title: "Seed distribution", dueDate: "2025-07-05", state: "OPEN", href: "/x", projectId: "p1" }],
  });
  assert.equal(items.length, 1);
  assert.equal(items[0]!.kind, "PLAN");
  assert.equal(items[0]!.mine, true);
});

/* ------------------------------------------------------------------ movements and week */

test("only work whose dates moved, and only in this quarter, is listed", () => {
  const movements = movedThisQuarter(
    [
      { id: "a1", title: "Moved now", plannedEnd: "2025-08-10", originalEnd: "2025-07-10", status: "PLANNED" },
      { id: "a2", title: "Moved earlier", plannedEnd: "2025-05-10", originalEnd: "2025-06-10", status: "PLANNED" },
      { id: "a3", title: "Not moved", plannedEnd: "2025-08-10", originalEnd: "2025-08-10", status: "PLANNED" },
    ],
    "2025-07-15",
  );
  assert.deepEqual(movements.map((m) => m.title), ["Moved now"]);
});

test("the week shows the team's work, whoever owns it", () => {
  const week = teamsWeek(
    [
      { id: "a1", title: "This week", plannedEnd: "2025-07-18", status: "PLANNED", signal: "ON_TIME", ownerUserId: "u1" },
      { id: "a2", title: "Later", plannedEnd: "2025-08-18", status: "PLANNED", signal: "ON_TIME" },
      { id: "a3", title: "Done", plannedEnd: "2025-07-17", status: "DONE", signal: "DONE" },
    ],
    "2025-07-15",
  );
  assert.deepEqual(week.map((w) => w.title), ["This week"]);
});

/* ------------------------------------------------------------------ needs you */

const needsYouBase = {
  today: "2025-07-15",
  projectId: "p1",
  canApproveReport: false,
  canReviewActivity: false,
  canVerifyEvidence: false,
  canManageRisks: false,
  periods: [{ id: "q3", reportType: "QUARTERLY", status: "UNDER_REVIEW", readinessScore: 62, deadline: "2025-07-20", daysUntilDeadline: 5 }],
  assignments: [] as { key: string; kind: string; title: string; dueDate?: string; state: string; href: string; projectId: string }[],
  risks: [] as { id: string; title: string; reviewBy?: string; status: string }[],
};

test("a report is only offered to someone who may approve it", () => {
  assert.equal(needsYouItems(needsYouBase).length, 0);
  const items = needsYouItems({ ...needsYouBase, canApproveReport: true });
  assert.equal(items.length, 1);
  assert.equal(items[0]!.kind, "APPROVE_REPORT");
});

test("activities to accept are counted together", () => {
  const items = needsYouItems({
    ...needsYouBase,
    canReviewActivity: true,
    assignments: [
      { key: "a1", kind: "ACTIVITY_REVIEW", title: "One", state: "OPEN", href: "/x", projectId: "p1" },
      { key: "a2", kind: "ACTIVITY_REVIEW", title: "Two", state: "OPEN", href: "/x", projectId: "p1" },
    ],
  });
  const activity = items.find((item) => item.kind === "ACCEPT_ACTIVITY");
  assert.ok(activity);
  assert.match(activity!.title, /2 completed activities/);
});

test("a risk review is only raised for someone who manages risks, and only when it is late", () => {
  const late = needsYouItems({
    ...needsYouBase,
    canManageRisks: true,
    risks: [{ id: "r1", title: "Road cut", reviewBy: "2025-07-01", status: "OPEN" }],
  });
  assert.equal(late.length, 1);
  assert.equal(late[0]!.kind, "RISK_REVIEW");
  const notYet = needsYouItems({
    ...needsYouBase,
    canManageRisks: true,
    risks: [{ id: "r1", title: "Road cut", reviewBy: "2025-08-01", status: "OPEN" }],
  });
  assert.equal(notYet.length, 0);
});

test("what is late comes before what is not", () => {
  const items = needsYouItems({
    ...needsYouBase,
    canApproveReport: true,
    canReviewActivity: true,
    assignments: [{ key: "a1", kind: "INDICATOR_VALUE", title: "Late value", dueDate: "2025-07-01", state: "LATE", href: "/x", projectId: "p1" }],
  });
  assert.equal(items[0]!.kind, "OVERDUE_VALUE");
  assert.equal(items[0]!.urgent, true);
});

/* ------------------------------------------------------------------ close-out */

test("close-out counts the months that are left", () => {
  const closing = closeOut("2025-01-01", "2025-12-31", "2025-07-15");
  assert.equal(closing.monthsRemaining, 5);
  // Five months left is inside the last six months, so closing is already near.
  assert.equal(closing.finalYear, true);
  assert.equal(closeOut("2025-01-01", "2025-12-31", "2025-11-15").finalYear, true);
  assert.equal(closeOut("2025-01-01", "2027-12-31", "2025-07-15").finalYear, false);
});


/* ---- lower-is-better indicators and the latest recorded value (demo 11 findings) ---- */

const twoMonths = (): DataSheet => ({
  projectId: "p2",
  periods: [
    { id: "nov", label: "Nov 2026", start: "2026-11-01", end: "2026-11-30", reportType: "MONTHLY", locked: false },
    { id: "dec", label: "Dec 2026", start: "2026-12-01", end: "2026-12-31", reportType: "MONTHLY", locked: false },
    { id: "jan", label: "Jan 2027", start: "2027-01-01", end: "2027-01-31", reportType: "MONTHLY", locked: false },
  ],
  indicators: [
    { id: "stock", code: "OP1-3", name: "Stock-out days", level: "OUTPUT", type: "NUMBER", baseline: "4", target: "2", isRate: false, lowerIsBetter: true },
    { id: "trained", code: "OP1-1", name: "Trained", level: "OUTPUT", type: "NUMBER", baseline: "0", target: "100", isRate: false },
  ],
  cells: [
    { indicatorId: "stock", periodId: "nov", periodValue: "2.5", cumulativeValue: "", status: "VERIFIED" },
    { indicatorId: "trained", periodId: "nov", periodValue: "40", cumulativeValue: "40", status: "VERIFIED" },
    { indicatorId: "trained", periodId: "dec", periodValue: "30", cumulativeValue: "70", status: "VERIFIED" },
  ],
  finance: [],
} as unknown as DataSheet);

test("an indicator where lower is better has no share of target, so a worse result is never read as ahead", () => {
  const s = twoMonths();
  assert.equal(latestPercentOfTarget(s, s.indicators[0]!), null);
  const pace = resultsPace(s, 50);
  assert.equal(pace.measured, 1, "only the higher-is-better indicator is read as a share of target");
  assert.equal(latestPercentOfTarget(s, s.indicators[1]!), 70);
});

test("the latest value is the most recent period that has one, not the last period on the calendar", () => {
  const s = twoMonths();
  assert.equal(latestRecordedCell(s, "trained")?.cumulativeValue, "70");
  assert.equal(latestRecordedCell(s, "stock")?.periodValue, "2.5");
  assert.equal(latestRecordedCell(s, "unknown"), undefined);
});
