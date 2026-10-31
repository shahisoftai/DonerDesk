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
