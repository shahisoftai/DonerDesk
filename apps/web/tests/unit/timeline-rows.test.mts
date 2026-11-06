import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutTimeline, type TimelineRow } from "../../src/features/workplan/domain/timeline-layout.ts";
import { flattenLayout, linesHeight, filterRows, isFiltering, NO_FILTER, GROUP_ROW_PX, LANE_ROW_PX } from "../../src/features/workplan/domain/timeline-rows.ts";

const row = (id: string, extra: Partial<TimelineRow> = {}): TimelineRow => ({
  id, title: id, plannedStart: "2026-03-02", plannedEnd: "2026-03-04", status: "PLANNED", signal: "ON_TIME", signalLabel: "On time", deliveredCount: 0, ...extra,
});
const lay = (rows: TimelineRow[]) => layoutTimeline({ rows, deadlines: [], range: { start: "2026-03-01", end: "2026-03-31" }, zoom: "MONTH", today: "2026-03-11", outputTitles: new Map([["o1", "Output 1"]]) });

test("one flat list: a header per output, then its lines; a collapsed group keeps only its header", () => {
  const l = lay([row("a", { outputId: "o1" }), row("b", { outputId: "o1", status: "DONE", signal: "DONE" }), row("c")]);
  const open = flattenLayout(l, new Set());
  assert.deepEqual(open.map((x) => x.kind), ["GROUP", "LANE", "LANE", "GROUP", "LANE"]);
  const first = open[0]!;
  assert.ok(first.kind === "GROUP" && first.count === 2 && first.donePct === 50);
  const shut = flattenLayout(l, new Set(["o1"]));
  assert.deepEqual(shut.map((x) => x.kind), ["GROUP", "GROUP", "LANE"]);
  assert.equal(linesHeight(open), 2 * GROUP_ROW_PX + 3 * LANE_ROW_PX);
  assert.equal(linesHeight(shut), 2 * GROUP_ROW_PX + LANE_ROW_PX);
});

test("a group counts its late activities and ignores cancelled ones in its percentage", () => {
  const l = lay([row("a", { outputId: "o1", signal: "LATE", signalLabel: "Late" }), row("b", { outputId: "o1", status: "CANCELLED", signal: "CANCELLED" }), row("c", { outputId: "o1", status: "DONE", signal: "DONE" })]);
  const g = flattenLayout(l, new Set())[0]!;
  assert.ok(g.kind === "GROUP" && g.lateCount === 1 && g.donePct === 50);
});

test("filters: text matches title or lead, mine, late only, hide finished, completed only; none means no filtering", () => {
  const rows = [
    row("Training", { ownerUserId: "u1" }), row("Survey", { ownerUserId: "u2", signal: "LATE" }),
    row("Report", { ownerUserId: "u2", status: "DONE", signal: "DONE" }),
    row("Dropped", { ownerUserId: "u2", status: "CANCELLED", signal: "CANCELLED" }),
  ];
  const names = { u1: "Amara Okafor", u2: "Grace Achieng" };
  assert.equal(isFiltering(NO_FILTER), false);
  assert.equal(filterRows(rows, NO_FILTER, names).length, 4);
  assert.deepEqual(filterRows(rows, { ...NO_FILTER, query: "grace" }, names).map((r) => r.title), ["Survey", "Report", "Dropped"]);
  assert.deepEqual(filterRows(rows, { ...NO_FILTER, query: "TRAIN" }, names).map((r) => r.title), ["Training"]);
  assert.deepEqual(filterRows(rows, { ...NO_FILTER, mineUserId: "u1" }, names).map((r) => r.title), ["Training"]);
  assert.deepEqual(filterRows(rows, { ...NO_FILTER, lateOnly: true }, names).map((r) => r.title), ["Survey"]);
  assert.deepEqual(filterRows(rows, { ...NO_FILTER, hideFinished: true }, names).map((r) => r.title), ["Training", "Survey"]);
  assert.deepEqual(filterRows(rows, { ...NO_FILTER, completedOnly: true }, names).map((r) => r.title), ["Report", "Dropped"], "§16d: done and cancelled");
  assert.equal(isFiltering({ ...NO_FILTER, lateOnly: true }), true);
  assert.equal(isFiltering({ ...NO_FILTER, completedOnly: true }), true);
  const helper = [{ ...row("Helped"), ownerUserId: "x", supportUserIds: ["u1"] }];
  assert.equal(filterRows(helper, { ...NO_FILTER, mineUserId: "u1" }, names).length, 1, "a helper counts as mine");
});
