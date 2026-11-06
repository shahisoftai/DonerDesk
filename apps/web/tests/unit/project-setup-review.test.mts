// Phase 36.4: the review screen's pure rules, and the wording the setup screens show (no codes, ids or snake_case).
import test from "node:test";
import assert from "node:assert/strict";
import { countRows, nextPending, rowsForField, summarise, editableText, showsConfidence, statusKey } from "../../src/features/project-setup/domain/review-state.ts";

const item = (value: unknown, status = "PROPOSED", confidence = "HIGH", quote: string | null = "q") => ({
  value, sourceQuote: value === null ? null : quote, sourceRef: null, confidence, status,
});
const emptyFacts = () => ({
  name: item(null), code: item(null), donor: item(null), countries: item(null), sectors: item(null),
  startDate: item(null), endDate: item(null), currency: item(null), summary: item(null),
});

test("summarise reads a value in one line and says Not stated for nothing", () => {
  assert.equal(summarise(null), "Not stated");
  assert.equal(summarise("  "), "Not stated");
  assert.equal(summarise(["Uganda", "Kenya"]), "Uganda, Kenya");
  assert.equal(summarise({ code: "1.1", title: "Households use water", quote: "x", block: 3, level: "OUTCOME" }), "[1.1] · Households use water");
  assert.equal(summarise({ quote: "x" }), "Not stated");
});

test("facts keep their fixed order and show each fact's own state", () => {
  const facts = { ...emptyFacts(), name: item("Blue Water", "ACCEPTED") };
  const proposal = { facts, logframe: [], indicators: [], periods: [], plan: [], places: [], funding: [], budget: [], risks: [] } as never;
  const section = rowsForField(proposal, "facts", []);
  assert.equal(section.rows[0]!.label, "Project name");
  assert.equal(section.rows[0]!.summary, "Blue Water");
  assert.equal(section.rows[0]!.isFact, true);
  assert.equal(section.rows.length, 9);
});

test("list items are labelled by their own title and carry the problems that name them", () => {
  const proposal = {
    facts: emptyFacts(),
    logframe: [item({ level: "GOAL", code: "1", title: "Health", parentCode: null }), item({ level: "OUTCOME", code: "1.1", title: "Water", parentCode: "9" })],
    indicators: [], periods: [], plan: [], places: [], funding: [], budget: [], risks: [],
  } as never;
  const problems = [{ code: "LOGFRAME_PARENT_UNKNOWN", path: "logframe.1.parentCode", severity: "HARD", message: "Parent 9 is not in the logframe." }] as never;
  const rows = rowsForField(proposal, "logframe", problems).rows;
  assert.equal(rows[0]!.label, "Health");
  assert.equal(rows[1]!.problems.length, 1);
  assert.equal(rows[0]!.problems.length, 0);
});

test("counts: only stated items are counted; accepted and edited are to apply, rejected are out, the rest wait for the person", () => {
  const rows = [
    { status: "ACCEPTED", summary: "a" }, { status: "EDITED", summary: "b" }, { status: "REJECTED", summary: "c" },
    { status: "PROPOSED", summary: "Not stated" }, { status: "PROPOSED", summary: "d" },
  ] as never;
  assert.deepEqual(countRows(rows), { total: 4, accepted: 2, rejected: 1, notStated: 1, pending: 1 });
});

test("next pending moves through the rows the person still has to decide, and wraps", () => {
  const rows = [
    { path: "logframe.0", status: "PROPOSED", summary: "a" }, { path: "logframe.1", status: "ACCEPTED", summary: "b" },
    { path: "logframe.2", status: "PROPOSED", summary: "c" }, { path: "logframe.3", status: "PROPOSED", summary: "Not stated" },
  ] as never;
  assert.equal(nextPending(rows)?.path, "logframe.0");
  assert.equal(nextPending(rows, "logframe.0")?.path, "logframe.2");
  assert.equal(nextPending(rows, "logframe.2")?.path, "logframe.0", "wraps to the first");
  assert.equal(nextPending([] as never), undefined);
});

test("a person writes their own value as plain text, never as JSON", () => {
  assert.equal(editableText("Blue Water"), "Blue Water");
  assert.equal(editableText(null), "");
});

// Phase 37: where an item is placed, the results it may be placed under, and what the reading left out.
import { resultOptions, leftOutFor } from "../../src/features/project-setup/domain/review-state.ts";

test("a linked row shows its result, who chose it, and its work-plan heading; the options skip rejected results", () => {
  const proposal = {
    facts: emptyFacts(),
    logframe: [item({ level: "OUTPUT", code: "OP1", title: "Clinics established", description: null, parentCode: null }), item({ level: "OUTPUT", code: "OP2", title: "Gone", description: null, parentCode: null }, "REJECTED")],
    indicators: [], periods: [], places: [], funding: [], budget: [], risks: [],
    plan: [item({ title: "Set up clinics", logframeCode: "OP1", linkSource: "SUGGESTED", start: null, end: null, location: null, lead: null, group: "Task- 8 Establish remote clinics", planCode: "8.1" }), item({ title: "Other", logframeCode: null, start: null, end: null, location: null, lead: null })],
  };
  const { rows } = rowsForField(proposal as never, "plan", []);
  assert.deepEqual(rows[0].link, { code: "OP1", title: "Clinics established", source: "SUGGESTED" });
  assert.equal(rows[0].group, "Task- 8 Establish remote clinics");
  assert.equal(rows[0].summary.includes("8.1"), false, "the plan code and the heading are not repeated in the summary");
  assert.deepEqual(rows[1].link, { code: null, title: null, source: "DOCUMENT" });
  assert.deepEqual(resultOptions(proposal as never).map((o) => o.code), ["OP1"]);
  assert.equal(rowsForField(proposal as never, "logframe", []).rows[0].link, undefined);
});

test("leftOutFor reads the last finished reading of an area and tolerates a malformed list", () => {
  const runs = [
    { kind: "EXTRACT", area: "PLAN", status: "FINISHED", detail: { dropped: 1, leftOut: JSON.stringify([{ field: "plan", text: "old", reason: "QUOTE_NOT_FOUND" }]) } },
    { kind: "EXTRACT", area: "PLAN", status: "FINISHED", detail: { dropped: 50, leftOut: JSON.stringify([{ field: "plan", text: "Train 20", reason: "FIGURE_NOT_IN_QUOTE" }, { bad: true }]) } },
    { kind: "EXTRACT", area: "RISKS", status: "FINISHED", detail: { dropped: 2, leftOut: "{not json" } },
  ];
  assert.deepEqual(leftOutFor(runs, "PLAN"), { items: [{ field: "plan", text: "Train 20", reason: "FIGURE_NOT_IN_QUOTE" }], total: 50 });
  assert.deepEqual(leftOutFor(runs, "RISKS"), { items: [], total: 2 });
  assert.deepEqual(leftOutFor(runs, "FACTS"), { items: [], total: 0 });
});

// Phase 37 second pass: moving results, the work plan chart, quotes in their passage, other readings.
import { parentOptions } from "../../src/features/project-setup/domain/review-state.ts";
import { ganttLayout } from "../../src/features/project-setup/domain/plan-gantt.ts";
import { highlightParts } from "../../src/features/project-setup/domain/passage.ts";

test("parentOptions offers only higher results that are not the result itself or one of its parts", () => {
  const options = [
    { code: "G", level: "GOAL", title: "g", parentCode: null },
    { code: "O1", level: "OUTCOME", title: "o1", parentCode: "G" },
    { code: "P1", level: "OUTPUT", title: "p1", parentCode: "O1" },
    { code: "O2", level: "OUTCOME", title: "o2", parentCode: "G" },
  ];
  assert.deepEqual(parentOptions(options, "P1", "OUTPUT").map((o) => o.code), ["G", "O1", "O2"]);
  assert.deepEqual(parentOptions(options, "O1", "ACTIVITY").map((o) => o.code), ["G", "O2"], "never under its own output");
  assert.deepEqual(parentOptions(options, "G", "GOAL"), []);
});

test("ganttLayout places dated activities on the plan's span, ticks the months and lists undated ones apart", () => {
  const layout = ganttLayout([
    { path: "plan.0", title: "Kick-off", start: "2023-07-22", end: "2023-07-28", status: "ACCEPTED" },
    { path: "plan.1", title: "Training", start: "2023-08-01", end: "2023-08-31", status: "PROPOSED" },
    { path: "plan.2", title: "Report", start: null, end: null, status: "PROPOSED" },
    { path: "plan.3", title: "Dropped", start: "2025-01-01", end: "2025-01-02", status: "REJECTED" },
  ])!;
  assert.deepEqual([layout.start, layout.end], ["2023-07-22", "2023-08-31"]);
  assert.equal(layout.bars[0].left, 0);
  assert.ok(layout.bars[1].left + layout.bars[1].width <= 100.1);
  assert.deepEqual(layout.months.map((m) => m.label), ["2023-08"]);
  assert.deepEqual(layout.undated.map((u) => u.title), ["Report"]);
  assert.equal(ganttLayout([{ path: "p", title: "x", start: null, end: null, status: "PROPOSED" }]), null);
});

test("highlightParts marks the quote in its passage across tab or space differences, and marks nothing it cannot find", () => {
  assert.deepEqual(highlightParts("2.4\tHiring of staff\tOrganogram", "2.4 Hiring of staff").map((p) => p.mark), [true, false]);
  assert.deepEqual(highlightParts("Some text", "not there"), [{ text: "Some text", mark: false }]);
});

test("a fact with other readings and a quote's place travel to its row; a budget detail row says so", () => {
  const proposal = {
    facts: { ...emptyFacts(), startDate: { ...item("2023-07-01"), sourceRef: { documentId: "source-1", block: 3 }, alternatives: [{ value: "2023-07-22", sourceQuote: "from 2023-07-22", sourceRef: null }] } },
    logframe: [], indicators: [], periods: [], plan: [], places: [], funding: [], risks: [],
    budget: [item({ category: "Director", amount: "60", currency: "PKR", logframeCode: null, kind: "DETAIL", ref: "A.1" })],
  };
  const fact = rowsForField(proposal as never, "facts", []).rows.find((r) => r.factKey === "startDate")!;
  assert.deepEqual(fact.alternatives, [{ summary: "2023-07-22", quote: "from 2023-07-22" }]);
  assert.deepEqual(fact.sourceRef, { documentId: "source-1", block: 3 });
  const detail = rowsForField(proposal as never, "budget", []).rows[0];
  assert.equal(detail.budgetKind, "DETAIL");
  assert.equal(detail.summary.includes("A.1"), false);
});
