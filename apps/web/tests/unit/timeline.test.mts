import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutTimeline, timelineRange, TIMELINE_ZOOMS, OTHER_OUTPUT_TITLE, type TimelineRow } from "../../src/features/workplan/domain/timeline-layout.ts";
import { pixelsToDays, applyDrag, keyboardDrag, isDraggable, confirmQuestion, sameDates } from "../../src/features/workplan/domain/timeline-drag.ts";
import { weekCells, monthCells } from "../../src/features/workplan/domain/calendar-layout.ts";
import { groupMyWeek } from "../../src/features/workplan/domain/my-week.ts";

const row = (id: string, start: string, end: string, extra: Partial<TimelineRow> = {}): TimelineRow => ({
  id, title: id, plannedStart: start, plannedEnd: end, status: "PLANNED", signal: "ON_TIME", signalLabel: "On time", deliveredCount: 0, ...extra,
});
const MARCH = { start: "2026-03-01", end: "2026-03-31" };
const layout = (rows: TimelineRow[], extra: Record<string, unknown> = {}) =>
  layoutTimeline({ rows, deadlines: [], range: MARCH, zoom: "MONTH", today: "2026-03-11", outputTitles: new Map([["o1", "Output 1"]]), ...extra });

test("zoom ranges: the month and quarter containing today, or the whole project", () => {
  assert.deepEqual(timelineRange("MONTH", "2026-02-11", { start: "2026-01-01", end: "2026-12-31" }), { start: "2026-02-01", end: "2026-02-28" });
  assert.deepEqual(timelineRange("MONTH", "2028-02-11", { start: "2026-01-01", end: "2028-12-31" }), { start: "2028-02-01", end: "2028-02-29" }, "leap year");
  assert.deepEqual(timelineRange("QUARTER", "2026-05-20", { start: "2026-01-01", end: "2026-12-31" }), { start: "2026-04-01", end: "2026-06-30" });
  assert.deepEqual(timelineRange("QUARTER", "2026-12-31", { start: "2026-01-01", end: "2026-12-31" }), { start: "2026-10-01", end: "2026-12-31" });
  assert.deepEqual(timelineRange("PROJECT", "2026-05-20", { start: "2026-01-01", end: "2027-06-30" }), { start: "2026-01-01", end: "2027-06-30" });
  assert.equal(TIMELINE_ZOOMS.length, 3);
});

test("a bar is placed as percentages of the visible range, including both end days", () => {
  const l = layout([row("a", "2026-03-01", "2026-03-31"), row("b", "2026-03-11", "2026-03-20")]);
  const [a, b] = l.groups[0]!.bars;
  assert.deepEqual([a!.leftPct, a!.widthPct], [0, 100]);
  assert.deepEqual([b!.leftPct, b!.widthPct], [32.26, 32.26]);
  assert.equal(l.days, 31);
});

test("overlapping activities stay in their own bars, sorted by date, grouped by output with 'Other' last", () => {
  const l = layout([row("x", "2026-03-05", "2026-03-10"), row("y", "2026-03-01", "2026-03-20", { outputId: "o1" }), row("z", "2026-03-02", "2026-03-04", { outputId: "o1" })]);
  assert.deepEqual(l.groups.map((g) => [g.title, g.bars.map((b) => b.id)]), [["Output 1", ["y", "z"]], [OTHER_OUTPUT_TITLE, ["x"]]]);
});

test("range clipping: bars crossing the edge are cut and flagged, bars outside are counted not drawn", () => {
  const l = layout([row("in", "2026-02-20", "2026-03-05"), row("out", "2026-03-25", "2026-04-10"), row("before", "2026-01-01", "2026-02-10"), row("after", "2026-04-01", "2026-04-02")]);
  const bars = l.groups.flatMap((g) => g.bars);
  const inBar = bars.find((b) => b.id === "in")!;
  assert.deepEqual([inBar.leftPct, inBar.widthPct, inBar.clippedStart, inBar.clippedEnd], [0, 16.13, true, false]);
  const outBar = bars.find((b) => b.id === "out")!;
  assert.deepEqual([outBar.clippedStart, outBar.clippedEnd], [false, true]);
  assert.equal(outBar.leftPct + outBar.widthPct, 100);
  assert.equal(bars.length, 2);
  assert.equal(l.hidden, 2);
});

test("a milestone is one day wide and flagged; moved activities carry their original place", () => {
  const l = layout([row("m", "2026-03-11", "2026-03-11"), row("mv", "2026-03-20", "2026-03-22", { originalStart: "2026-03-10", originalEnd: "2026-03-12" }), row("same", "2026-03-05", "2026-03-06", { originalStart: "2026-03-05", originalEnd: "2026-03-06" })]);
  const bars = l.groups.flatMap((g) => g.bars);
  assert.equal(bars.find((b) => b.id === "m")!.milestone, true);
  assert.equal(bars.find((b) => b.id === "m")!.widthPct, 3.23);
  assert.deepEqual(bars.find((b) => b.id === "mv")!.original, { leftPct: 29.03, widthPct: 9.68 });
  assert.equal(bars.find((b) => b.id === "same")!.original, undefined, "an unmoved activity has no outline");
});

test("progress: delivered of target, full when done, absent when unknown; each bar has a spoken label", () => {
  const l = layout([
    row("t", "2026-03-02", "2026-03-30", { targetCount: 4, deliveredCount: 1 }),
    row("over", "2026-03-03", "2026-03-30", { targetCount: 2, deliveredCount: 5 }),
    row("d", "2026-03-04", "2026-03-30", { status: "DONE", signal: "DONE", signalLabel: "Done" }),
    row("n", "2026-03-05", "2026-03-30"),
  ]);
  const p = Object.fromEntries(l.groups.flatMap((g) => g.bars).map((b) => [b.id, b.progressPct]));
  assert.deepEqual(p, { t: 25, over: 100, d: 100, n: undefined });
  assert.equal(l.groups[0]!.bars.find((b) => b.id === "d")!.label, "d, 4 Mar to 30 Mar, Done");
});

test("today line and report deadlines appear only inside the range; weeks tick on Mondays", () => {
  const l = layout([], { deadlines: [{ date: "2026-03-15", label: "Report due", kind: "DEADLINE" }, { date: "2026-04-15", label: "Later", kind: "DEADLINE" }, { date: "2026-03-08", label: "Review", kind: "REVIEW" }] });
  assert.equal(l.todayPct, 32.26);
  assert.deepEqual(l.deadlines.map((d) => [d.label, d.kind]), [["Review 8 Mar", "REVIEW"], ["Report due 15 Mar", "DEADLINE"]]);
  assert.deepEqual(l.ticks.map((t) => t.label), ["2", "9", "16", "23", "30"]);
  assert.equal(layout([], { today: "2026-05-01" }).todayPct, null);
});

test("quarter and project zooms tick on month starts; a long project ticks every third month; an empty plan lays out empty", () => {
  const q = layoutTimeline({ rows: [], deadlines: [], range: { start: "2026-04-01", end: "2026-06-30" }, zoom: "QUARTER", today: "2026-05-01", outputTitles: new Map() });
  assert.deepEqual(q.ticks.map((t) => t.label), ["Apr", "May", "Jun"]);
  const long = layoutTimeline({ rows: [], deadlines: [], range: { start: "2026-01-01", end: "2028-12-31" }, zoom: "PROJECT", today: "2026-05-01", outputTitles: new Map() });
  assert.deepEqual(long.ticks.slice(0, 3).map((t) => t.label), ["Jan", "Apr", "Jul"]);
  assert.deepEqual(layout([]).groups, []);
});

test("120 repeating rows lay out without trouble", () => {
  const rows = Array.from({ length: 120 }, (_, i) => row(`r${i}`, `2026-03-${String((i % 28) + 1).padStart(2, "0")}`, `2026-03-${String((i % 28) + 1).padStart(2, "0")}`));
  assert.equal(layout(rows).groups[0]!.bars.length, 120);
});

test("dragging: pixels to whole days, move / start / end, never inverted", () => {
  assert.equal(pixelsToDays(100, 620, 31), 5);
  assert.equal(pixelsToDays(-20, 620, 31), -1);
  assert.equal(pixelsToDays(4, 620, 31), 0);
  assert.equal(Object.is(pixelsToDays(-1, 620, 31), 0), true, "no negative zero");
  assert.equal(pixelsToDays(50, 0, 31), 0);
  const d = { start: "2026-03-10", end: "2026-03-12" };
  assert.deepEqual(applyDrag(d, "MOVE", 3), { start: "2026-03-13", end: "2026-03-15" });
  assert.deepEqual(applyDrag(d, "START", -2), { start: "2026-03-08", end: "2026-03-12" });
  assert.deepEqual(applyDrag(d, "START", 9), { start: "2026-03-12", end: "2026-03-12" }, "the start stops at the end");
  assert.deepEqual(applyDrag(d, "END", -9), { start: "2026-03-10", end: "2026-03-10" }, "the end stops at the start");
  assert.deepEqual(applyDrag({ start: "2026-02-27", end: "2026-02-28" }, "MOVE", 2), { start: "2026-03-01", end: "2026-03-02" });
  assert.equal(sameDates(d, { ...d }), true);
});

test("keyboard: arrows move a day, Shift changes the end; only open activities for people who can move are draggable", () => {
  assert.deepEqual(keyboardDrag("ArrowRight", false), { mode: "MOVE", delta: 1 });
  assert.deepEqual(keyboardDrag("ArrowLeft", true), { mode: "END", delta: -1 });
  assert.equal(keyboardDrag("Enter", false), undefined);
  assert.equal(isDraggable("PLANNED", true), true);
  assert.equal(isDraggable("IN_PROGRESS", true), true);
  assert.equal(isDraggable("DONE", true), false);
  assert.equal(isDraggable("CANCELLED", true), false);
  assert.equal(isDraggable("PLANNED", false), false);
  assert.equal(confirmQuestion({ start: "2026-03-12", end: "2026-03-14" }, "2026-03-01"), "Move to 12–14 Mar?");
  assert.equal(confirmQuestion({ start: "2026-03-30", end: "2026-04-02" }, "2026-03-01"), "Move to 30 Mar–2 Apr?");
  assert.equal(confirmQuestion({ start: "2026-03-12", end: "2026-03-12" }, "2026-03-01"), "Move to 12 Mar?");
});

test("calendar: a week is Monday to Sunday; a month grid is whole weeks; an item shows on every day it covers", () => {
  const item = { id: "a", plannedStart: "2026-03-10", plannedEnd: "2026-03-12" };
  const week = weekCells("2026-03-11", [item]);
  assert.deepEqual(week.map((c) => c.date), ["2026-03-09", "2026-03-10", "2026-03-11", "2026-03-12", "2026-03-13", "2026-03-14", "2026-03-15"]);
  assert.deepEqual(week.map((c) => c.items.length), [0, 1, 1, 1, 0, 0, 0]);
  assert.equal(week.find((c) => c.isToday)!.date, "2026-03-11");
  const month = monthCells("2026-03-11", [item]);
  assert.equal(month.length, 6, "1 March 2026 is a Sunday, so a Monday-first grid needs six weeks");
  assert.ok(month.every((w) => w.length === 7));
  assert.equal(month[0]![0]!.date, "2026-02-23");
  assert.equal(month[0]![0]!.inMonth, false);
  assert.equal(month.at(-1)!.at(-1)!.date, "2026-04-05");
  assert.equal(monthCells("2026-02-11", []).length, 5, "February 2026 also starts on a Sunday");
  assert.equal(monthCells("2027-02-11", []).length, 4, "February 2027 starts on a Monday and fits four weeks");
});

test("my week: late first, then this week, then next week; later work is not part of the week", () => {
  const r = (id: string, start: string, end: string, signal: "ON_TIME" | "LATE" = "ON_TIME") => ({ id, plannedStart: start, plannedEnd: end, signal });
  const groups = groupMyWeek([r("later", "2026-04-20", "2026-04-21"), r("next", "2026-03-18", "2026-03-19"), r("this-b", "2026-03-13", "2026-03-13"), r("this-a", "2026-03-09", "2026-03-10"), r("late", "2026-02-01", "2026-02-03", "LATE"), r("long", "2026-03-01", "2026-06-01")], "2026-03-11");
  assert.deepEqual(groups.map((g) => [g.label, g.items.map((i) => i.id)]), [["Late", ["late"]], ["This week", ["long", "this-a", "this-b"]], ["Next week", ["next"]]]);
  assert.deepEqual(groupMyWeek([], "2026-03-11"), []);
  assert.equal(groupMyWeek([r("sun", "2026-03-15", "2026-03-15")], "2026-03-11")[0]!.label, "This week");
});

import { deadlinesFromPeriods } from "../../src/features/workplan/domain/timeline-deadlines.ts";
test("the deadline lane has each live period's due date and internal review date, in date order", () => {
  const out = deadlinesFromPeriods([
    { deadline: "2026-04-30T00:00:00.000Z", internalReviewDeadline: "2026-04-20T00:00:00.000Z" },
    { deadline: "2026-01-31T00:00:00.000Z", internalReviewDeadline: null },
    { deadline: "2026-07-31T00:00:00.000Z", cancelled: true },
  ]);
  assert.deepEqual(out.map((d) => [d.date, d.label, d.kind]), [["2026-01-31", "Report due", "DEADLINE"], ["2026-04-20", "Internal review", "REVIEW"], ["2026-04-30", "Report due", "DEADLINE"]]);
});

import { planCounts, outputProgress } from "../../src/features/workplan/domain/delivery-overview.ts";
const orow = (id: string, status: "PLANNED" | "IN_PROGRESS" | "DONE" | "CANCELLED", signal: "ON_TIME" | "LATE" | "DONE" | "CANCELLED", state: string, outputId?: string) => ({ id, status, signal, state, outputId });

test("plan counts leave out cancelled work and count each kind once", () => {
  const c = planCounts([orow("a", "DONE", "DONE", "DONE"), orow("b", "IN_PROGRESS", "ON_TIME", "IN_PROGRESS"), orow("c", "PLANNED", "LATE", "LATE_START"), orow("d", "PLANNED", "ON_TIME", "DUE_SOON"), orow("e", "CANCELLED", "CANCELLED", "CANCELLED")]);
  assert.deepEqual(c, { planned: 4, done: 1, underWay: 1, late: 1, dueSoon: 1 });
  assert.deepEqual(planCounts([]), { planned: 0, done: 0, underWay: 0, late: 0, dueSoon: 0 });
});

test("outputs: activities done of planned, beside the indicator's latest % of target; rates and unrecorded values are left out", () => {
  const sheet = {
    projectId: "p", finance: [],
    periods: [{ id: "q1", label: "Q1", start: "2026-01-01", end: "2026-03-31", reportType: "QUARTERLY", locked: false }, { id: "q2", label: "Q2", start: "2026-04-01", end: "2026-06-30", reportType: "QUARTERLY", locked: false }],
    indicators: [
      { id: "i1", code: "V-01", name: "Children vaccinated", level: "OUTPUT", type: "NUMBER", baseline: "0", target: "1500", isRate: false },
      { id: "i2", code: "V-02", name: "Coverage", level: "OUTPUT", type: "PERCENTAGE", baseline: "0", target: "90", isRate: true },
      { id: "i3", code: "V-03", name: "Nothing yet", level: "OUTPUT", type: "NUMBER", baseline: "0", target: "10", isRate: false },
    ],
    cells: [
      { indicatorId: "i1", periodId: "q1", periodValue: "400", cumulativeValue: "400", status: "VERIFIED" },
      { indicatorId: "i1", periodId: "q2", periodValue: "850", cumulativeValue: "1250", status: "VERIFIED" },
      { indicatorId: "i2", periodId: "q2", periodValue: "80", cumulativeValue: "", status: "VERIFIED" },
    ],
  };
  const out = outputProgress({
    rows: [orow("a", "DONE", "DONE", "DONE", "o1"), orow("b", "PLANNED", "LATE", "LATE_START", "o1"), orow("c", "CANCELLED", "CANCELLED", "CANCELLED", "o1"), orow("d", "PLANNED", "ON_TIME", "UPCOMING", "o2"), orow("e", "PLANNED", "ON_TIME", "UPCOMING")],
    outputs: [{ id: "o1", title: "Output 1" }, { id: "o2", title: "Output 2" }, { id: "o3", title: "Empty output" }],
    indicators: [{ id: "i1", logframeItemId: "act1" }, { id: "i2", logframeItemId: "o1" }, { id: "i3", logframeItemId: "o1" }],
    parentOf: new Map([["act1", "o1"]]),
    sheet,
    otherTitle: "Other activities",
  });
  assert.deepEqual(out.map((o) => [o.title, o.done, o.planned, o.late]), [["Output 1", 1, 2, 1], ["Output 2", 0, 1, 0], ["Other activities", 0, 1, 0]]);
  assert.deepEqual(out[0]!.indicators, [{ code: "V-01", name: "Children vaccinated", percent: "83%" }], "an indicator on an activity counts for its output; the rate and the unrecorded one are absent");
  assert.deepEqual(out[1]!.indicators, []);
  assert.equal(out.some((o) => o.title === "Empty output"), false, "an output with nothing planned is not listed");
  assert.equal(outputProgress({ rows: [orow("a", "PLANNED", "ON_TIME", "UPCOMING", "o1")], outputs: [{ id: "o1", title: "O" }], indicators: [], parentOf: new Map(), otherTitle: "x" })[0]!.indicators.length, 0, "no sheet, no percentages");
});

import { collectionText } from "../../src/features/tasks/domain/collection-view.ts";
test("beside an indicator row: due or overdue with the person, nothing once recorded or not yet due", () => {
  const names = { u2: "Amina" };
  assert.equal(collectionText({ dueBy: "2026-11-05", state: "DUE", ownerId: "u2" }, "2026-11-01", "me", names), "Due by 5 Nov · Amina");
  assert.equal(collectionText({ dueBy: "2026-11-05", state: "OVERDUE", ownerId: "me" }, "2026-11-10", "me", names), "Overdue since 5 Nov · you");
  assert.equal(collectionText({ dueBy: "2026-11-05", state: "DUE", ownerId: "u9" }, "2026-11-01", "me", names), "Due by 5 Nov · a team member");
  assert.equal(collectionText({ dueBy: "2026-11-05", state: "DUE" }, "2026-11-01", "me", names), "Due by 5 Nov");
  assert.equal(collectionText({ dueBy: "2026-11-05", state: "RECORDED", ownerId: "u2" }, "2026-11-10", "me", names), "");
  assert.equal(collectionText({ dueBy: "2026-11-05", state: "NOT_DUE", ownerId: "u2" }, "2026-11-01", "me", names), "");
  assert.equal(collectionText(undefined, "2026-11-01", "me", names), "");
});
