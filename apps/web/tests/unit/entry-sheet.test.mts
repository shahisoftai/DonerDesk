import assert from "node:assert/strict";
import test from "node:test";
import {
  SHEET_COLUMNS, EDITABLE_COLUMNS, FROZEN_COLUMN_COUNT, columnLetters, cellAddress, lockReason, cellState, cellProblem, percentOfTarget, normaliseCellText,
  moveSelection, selectionOf, rangeOf, rangeSize, inRange, parseClipboard, toClipboardText, cellText, planEdit, planPaste, planFillDown, planClear, planNotApplicable,
  applyChanges, invertChanges, emptyHistory, recordChange, undoStep, redoStep, HISTORY_LIMIT, rowIsClean, changedRowIds, toWritePlan, summarise,
  emptyPrefs, historyColumns, resolveColumns, resizeColumn, toggleColumn, moveColumn, parseSheetPrefs, defaultSheetPrefs, MIN_COLUMN_WIDTH, MAX_COLUMN_WIDTH, ZOOM_MIN, ZOOM_MAX,
  viewRowIds, findCell, goToCell, planFillTo, placeRows, withPlaceValues, planPlacePaste, editableBounds,
  type SheetRow, type SheetValues, type ValuesById, type SheetContext,
} from "../../src/features/reporting/domain/entry-sheet.ts";

const row = (id: string, over: Partial<SheetRow> = {}): SheetRow => ({ id, code: id.toUpperCase(), name: `Indicator ${id}`, type: "NUMBER", unit: "people", baseline: "0", target: "100", aggregation: "SUM", disaggregationRequired: false, update: null, ...over });
const vals = (over: Partial<SheetValues> = {}): SheetValues => ({ periodAchievement: "", cumulativeAchievement: "", comments: "", dataSource: "", notApplicableReason: "", disaggregation: [], ...over });
const ctx: SheetContext = { canEdit: true };
const col = (key: string) => SHEET_COLUMNS.findIndex((c) => c.key === key);

const rows: SheetRow[] = [row("a"), row("b"), row("c")];
const base = (): ValuesById => ({ a: vals(), b: vals(), c: vals() });

test("the columns: eleven, two frozen, four editable, in a fixed order", () => {
  assert.equal(SHEET_COLUMNS.length, 11);
  assert.equal(FROZEN_COLUMN_COUNT, 2);
  assert.deepEqual(EDITABLE_COLUMNS, ["periodAchievement", "cumulativeAchievement", "comments", "dataSource"]);
  assert.deepEqual(SHEET_COLUMNS.slice(0, 2).map((c) => c.key), ["code", "name"]);
});

test("column letters and cell addresses read like a spreadsheet", () => {
  assert.deepEqual([0, 1, 25, 26, 27, 51, 52, 701, 702].map(columnLetters), ["A", "B", "Z", "AA", "AB", "AZ", "BA", "ZZ", "AAA"]);
  assert.equal(cellAddress({ row: 2, col: 5 }), "F3");
});

test("a row is locked for one reason, and a verified value stays locked whatever else is true", () => {
  assert.equal(lockReason(row("a"), ctx), null);
  assert.equal(lockReason(row("a", { calculation: "A ÷ B" }), ctx), "CALCULATED");
  assert.equal(lockReason(row("a", { update: { verificationStatus: "VERIFIED", updatedAt: "t" } }), ctx), "VERIFIED");
  assert.equal(lockReason(row("a"), { canEdit: false }), "READ_ONLY");
  assert.equal(lockReason(row("a"), { canEdit: true, closedReason: "The entry window has closed." }), "CLOSED");
  assert.equal(lockReason(row("a", { update: { verificationStatus: "VERIFIED", updatedAt: "t" } }), { canEdit: false, closedReason: "x" }), "VERIFIED");
});

test("every state a cell can be in, with its precedence", () => {
  const init = vals({ periodAchievement: "10" });
  const st = (r: SheetRow, v: SheetValues, i = init, c = ctx) => cellState(r, "periodAchievement", v, i, c);
  assert.equal(st(row("a", { calculation: "x" }), init), "calculated");
  assert.equal(st(row("a", { update: { verificationStatus: "VERIFIED", updatedAt: "t" } }), init), "verified");
  assert.equal(st(row("a"), init, init, { canEdit: true, closedReason: "closed" }), "closed");
  assert.equal(st(row("a"), init, init, { canEdit: false }), "read-only");
  assert.equal(st(row("a"), vals({ notApplicableReason: "No clinics open" }), init), "not-applicable");
  assert.equal(st(row("a"), vals({ periodAchievement: "abc" }), init), "invalid");
  assert.equal(st(row("a"), vals({ periodAchievement: "12" }), init), "unsaved");
  assert.equal(st(row("a"), vals(), vals()), "empty");
  assert.equal(st(row("a", { update: { verificationStatus: "NEEDS_CORRECTION", updatedAt: "t" } }), init), "returned");
  assert.equal(st(row("a", { update: { verificationStatus: "SUBMITTED", updatedAt: "t" } }), init), "submitted");
  assert.equal(st(row("a", { update: { verificationStatus: "DRAFT", updatedAt: "t" } }), init), "saved");
  // "not applicable" colours the figure cells only
  assert.equal(cellState(row("a"), "comments", vals({ notApplicableReason: "x" }), vals({ notApplicableReason: "x" }), ctx), "empty");
});

test("whether a value is possible is the domain's rule: separators are fine, words and impossible percentages are not", () => {
  assert.equal(cellProblem(row("a"), "periodAchievement", "1,200"), null);
  assert.equal(cellProblem(row("a"), "periodAchievement", ""), null);
  assert.match(cellProblem(row("a"), "periodAchievement", "abc")!, /not a number/);
  assert.match(cellProblem(row("a"), "cumulativeAchievement", "-5")!, /negative/);
  assert.match(cellProblem(row("p", { type: "PERCENTAGE", unit: "%" }), "periodAchievement", "150")!, /percentage/);
  assert.match(cellProblem(row("y", { type: "YES_NO" }), "periodAchievement", "maybe")!, /Yes or No/);
  assert.equal(cellProblem(row("a"), "comments", "any words at all"), null);
  assert.match(cellProblem(row("f", { calculation: "A ÷ B" }), "periodAchievement", "5")!, /calculated/);
});

test("Yes/No words are normalised; other text is kept as typed apart from edge spaces and line breaks", () => {
  const y = row("y", { type: "YES_NO" });
  assert.deepEqual(["y", "Yes", "TRUE", "1"].map((t) => normaliseCellText(y, "periodAchievement", t)), ["YES", "YES", "YES", "YES"]);
  assert.deepEqual(["n", "No", "false", "0"].map((t) => normaliseCellText(y, "periodAchievement", t)), ["NO", "NO", "NO", "NO"]);
  assert.equal(normaliseCellText(row("a"), "periodAchievement", "  12 "), "12");
  assert.equal(normaliseCellText(row("a"), "comments", "line one\nline two  "), "line one line two");
});

test("% of target is shown only when it means something: never for a rate, a yes/no, a gap or a not-applicable row", () => {
  assert.equal(percentOfTarget(row("a"), vals({ cumulativeAchievement: "25" })), 25);
  assert.equal(percentOfTarget(row("a"), vals({ periodAchievement: "30" })), 30);
  assert.equal(percentOfTarget(row("a", { target: "3" }), vals({ cumulativeAchievement: "1" })), 33.3);
  assert.equal(percentOfTarget(row("a"), vals()), null);
  assert.equal(percentOfTarget(row("a", { target: "" }), vals({ cumulativeAchievement: "5" })), null);
  assert.equal(percentOfTarget(row("a", { target: "0" }), vals({ cumulativeAchievement: "5" })), null);
  assert.equal(percentOfTarget(row("r", { type: "PERCENTAGE", unit: "%" }), vals({ cumulativeAchievement: "50" })), null);
  assert.equal(percentOfTarget(row("y", { type: "YES_NO" }), vals({ cumulativeAchievement: "YES" })), null);
  assert.equal(percentOfTarget(row("a"), vals({ cumulativeAchievement: "5", notApplicableReason: "x" })), null);
});

test("selection: arrows move and stop at the edges, Shift extends, Ctrl jumps, Tab and Enter wrap like a spreadsheet", () => {
  const dims = { rows: 3, cols: SHEET_COLUMNS.length };
  const at = (row: number, c: number) => selectionOf({ row, col: c });
  const pe = col("periodAchievement");
  assert.deepEqual(moveSelection(at(1, pe), { key: "ArrowDown" }, dims)!.focus, { row: 2, col: pe });
  assert.deepEqual(moveSelection(at(2, pe), { key: "ArrowDown" }, dims)!.focus, { row: 2, col: pe });
  assert.deepEqual(moveSelection(at(0, 0), { key: "ArrowLeft" }, dims)!.focus, { row: 0, col: 0 });
  assert.deepEqual(moveSelection(at(1, pe), { key: "ArrowDown", ctrl: true }, dims)!.focus, { row: 2, col: pe });
  assert.deepEqual(moveSelection(at(1, pe), { key: "ArrowRight", ctrl: true }, dims)!.focus, { row: 1, col: SHEET_COLUMNS.length - 1 });
  const extended = moveSelection(at(0, pe), { key: "ArrowDown", shift: true }, dims)!;
  assert.deepEqual(extended.anchor, { row: 0, col: pe });
  assert.deepEqual(extended.focus, { row: 1, col: pe });
  const last = col("dataSource");
  assert.deepEqual(moveSelection(at(0, last), { key: "Tab" }, dims)!.focus, { row: 1, col: pe }, "Tab at the last editable column wraps to the next row");
  assert.deepEqual(moveSelection(at(1, pe), { key: "Tab", shift: true }, dims)!.focus, { row: 0, col: last });
  assert.deepEqual(moveSelection(at(0, pe), { key: "Enter" }, dims)!.focus, { row: 1, col: pe });
  assert.deepEqual(moveSelection(at(1, pe), { key: "Enter", shift: true }, dims)!.focus, { row: 0, col: pe });
  const tab = moveSelection(extended, { key: "Tab", shift: true }, dims)!;
  assert.deepEqual(tab.anchor, tab.focus, "Tab collapses a range");
  assert.equal(moveSelection(at(0, 0), { key: "a" }, dims), null);
  assert.equal(moveSelection(at(0, 0), { key: "ArrowDown" }, { rows: 0, cols: 5 }), null);
  assert.deepEqual(moveSelection(at(0, pe), { key: "Home" }, dims)!.focus, { row: 0, col: pe });
});

test("ranges are normalised however they were dragged", () => {
  const r = rangeOf({ anchor: { row: 3, col: 6 }, focus: { row: 1, col: 5 } });
  assert.deepEqual(r, { r1: 1, c1: 5, r2: 3, c2: 6 });
  assert.equal(rangeSize(r), 6);
  assert.equal(inRange(r, { row: 2, col: 5 }), true);
  assert.equal(inRange(r, { row: 0, col: 5 }), false);
});

test("clipboard text from Excel: tabs and lines, quotes, line breaks inside a cell, Windows line ends, a trailing newline", () => {
  assert.deepEqual(parseClipboard("1\t2\n3\t4"), [["1", "2"], ["3", "4"]]);
  assert.deepEqual(parseClipboard("1\t2\r\n3\t4\r\n"), [["1", "2"], ["3", "4"]]);
  assert.deepEqual(parseClipboard('"a\tb"\t"say ""hi"""\n"line\nbreak"'), [["a\tb", 'say "hi"'], ["line\nbreak"]]);
  assert.deepEqual(parseClipboard("7"), [["7"]]);
  assert.deepEqual(parseClipboard("\t5"), [["", "5"]]);
  assert.deepEqual(parseClipboard(""), []);
  const cells = [["a", 'b"c'], ["d\te", "f"]];
  assert.deepEqual(parseClipboard(toClipboardText(cells)), cells, "what is copied can be pasted back");
});

test("cell text for copying is the plain text of what the column shows", () => {
  const r = row("a", { target: "100", unit: "people", previousCumulative: "40", update: { verificationStatus: "DRAFT", updatedAt: "t" } });
  const v = vals({ periodAchievement: "10", cumulativeAchievement: "50" });
  assert.deepEqual(["code", "target", "previous", "periodAchievement", "percentOfTarget", "status"].map((k) => cellText(r, k as never, v)), ["A", "100 people", "40", "10", "50%", "DRAFT"]);
});

test("editing the period value fills the running total of a SUM indicator, but never over a total the person typed", () => {
  const r = row("a", { previousCumulative: "40" });
  const first = planEdit(r, "periodAchievement", "10", vals());
  assert.deepEqual(first.map((c) => [c.column, c.after]), [["periodAchievement", "10"], ["cumulativeAchievement", "50"]]);
  const after = applyChanges({ a: vals() }, first).a!;
  const second = planEdit(r, "periodAchievement", "12", after);
  assert.deepEqual(second.map((c) => [c.column, c.after]), [["periodAchievement", "12"], ["cumulativeAchievement", "52"]], "still the suggestion, so it follows");
  const own = vals({ periodAchievement: "10", cumulativeAchievement: "999" });
  assert.deepEqual(planEdit(r, "periodAchievement", "12", own).map((c) => c.column), ["periodAchievement"], "the person's own total is kept");
  assert.deepEqual(planEdit(row("l", { aggregation: "LATEST", previousCumulative: "40" }), "periodAchievement", "10", vals()).map((c) => c.column), ["periodAchievement"]);
  assert.deepEqual(planEdit(r, "periodAchievement", "10", vals({ periodAchievement: "10" })), [], "typing what is already there changes nothing");
});

test("a figure typed into a not-applicable row clears the reason, in the same undo step", () => {
  const r = row("a");
  const changes = planEdit(r, "periodAchievement", "5", vals({ notApplicableReason: "No clinics open" }));
  assert.ok(changes.some((c) => c.column === "notApplicableReason" && c.after === ""));
  assert.ok(!planEdit(r, "comments", "note", vals({ notApplicableReason: "x" })).some((c) => c.column === "notApplicableReason"));
});

test("pasting a block from Excel lands at the selected cell and sets what it can", () => {
  const pe = col("periodAchievement");
  const plan = planPaste({ rows, values: base(), ctx, anchor: { row: 0, col: pe }, text: "10\t50\tfield visit\tregister\n20\t90\t\t" });
  assert.equal(plan.problems.length, 0);
  const next = applyChanges(base(), plan.changes);
  assert.equal(next.a!.periodAchievement, "10");
  assert.equal(next.a!.cumulativeAchievement, "50", "a pasted total is kept, not replaced by a suggestion");
  assert.equal(next.a!.comments, "field visit");
  assert.equal(next.a!.dataSource, "register");
  assert.equal(next.b!.periodAchievement, "20");
  assert.equal(next.b!.cumulativeAchievement, "90");
  assert.equal(next.c!.periodAchievement, "");
  assert.equal(plan.applied, 6);
  assert.equal(plan.unchanged, 2, "empty pasted cells over empty cells change nothing");
});

test("a single pasted value fills the whole selected range", () => {
  const pe = col("periodAchievement");
  const plan = planPaste({ rows, values: base(), ctx, anchor: { row: 0, col: pe }, range: { r1: 0, c1: pe, r2: 2, c2: pe }, text: "5" });
  const next = applyChanges(base(), plan.changes);
  assert.deepEqual([next.a!.periodAchievement, next.b!.periodAchievement, next.c!.periodAchievement], ["5", "5", "5"]);
});

test("paste never changes a locked row or a read-only column, and says how many it skipped", () => {
  const locked = [row("a", { update: { verificationStatus: "VERIFIED", updatedAt: "t" } }), row("b"), row("f", { calculation: "A ÷ B" })];
  const v: ValuesById = { a: vals({ periodAchievement: "1" }), b: vals(), f: vals() };
  const plan = planPaste({ rows: locked, values: v, ctx, anchor: { row: 0, col: col("code") }, text: "X\tY\t1\t2\t3\t7\n9\t9\t9\t9\t9\t9\n9\t9\t9\t9\t9\t9" });
  const next = applyChanges(v, plan.changes);
  assert.equal(next.a!.periodAchievement, "1", "verified is untouched");
  assert.equal(next.f!.periodAchievement, "", "calculated is untouched");
  assert.equal(next.b!.periodAchievement, "9", "the open row took the figure");
  assert.ok(plan.skippedLocked >= 2);
  assert.ok(plan.skippedReadonly >= 5, "code, name, baseline, target, previous are read-only");
  const readOnly = planPaste({ rows, values: base(), ctx: { canEdit: false }, anchor: { row: 0, col: col("periodAchievement") }, text: "5" });
  assert.deepEqual(readOnly.changes, []);
  assert.equal(readOnly.skippedLocked, 1);
});

test("an impossible pasted value is named and not stored, while its neighbours still land", () => {
  const pe = col("periodAchievement");
  const plan = planPaste({ rows, values: base(), ctx, anchor: { row: 0, col: pe }, text: "10\nabc\n-4" });
  const next = applyChanges(base(), plan.changes);
  assert.equal(next.a!.periodAchievement, "10");
  assert.equal(next.b!.periodAchievement, "");
  assert.equal(next.c!.periodAchievement, "");
  assert.deepEqual(plan.problems.map((p) => [p.code, p.column]), [["B", "periodAchievement"], ["C", "periodAchievement"]]);
  assert.match(plan.problems[0]!.message, /not a number/);
});

test("a paste bigger than the sheet reports what did not fit; an unchanged cell is counted, not re-set; empty text does nothing", () => {
  const pe = col("periodAchievement");
  const tall = planPaste({ rows, values: base(), ctx, anchor: { row: 2, col: pe }, text: "1\n2\n3" });
  assert.equal(tall.overflowRows, 2);
  const wide = planPaste({ rows, values: base(), ctx, anchor: { row: 0, col: SHEET_COLUMNS.length - 1 }, text: "a\tb\tc" });
  assert.ok(wide.overflowCols >= 1);
  const same = planPaste({ rows, values: { ...base(), a: vals({ periodAchievement: "10", cumulativeAchievement: "10" }) }, ctx, anchor: { row: 0, col: pe }, text: "10" });
  assert.equal(same.unchanged, 1);
  assert.deepEqual(planPaste({ rows, values: base(), ctx, anchor: { row: 0, col: pe }, text: "" }).changes, []);
});

test("a figure pasted into a not-applicable row clears the reason", () => {
  const v = { ...base(), a: vals({ notApplicableReason: "No clinics open" }) };
  const plan = planPaste({ rows, values: v, ctx, anchor: { row: 0, col: col("periodAchievement") }, text: "7" });
  assert.equal(applyChanges(v, plan.changes).a!.notApplicableReason, "");
});

test("Ctrl+D copies the top value down each selected column, skipping locked rows", () => {
  const pe = col("periodAchievement");
  const r = [row("a"), row("b", { update: { verificationStatus: "VERIFIED", updatedAt: "t" } }), row("c")];
  const v: ValuesById = { a: vals({ periodAchievement: "8" }), b: vals({ periodAchievement: "1" }), c: vals() };
  const { changes, skippedLocked } = planFillDown({ rows: r, values: v, ctx, range: { r1: 0, c1: pe, r2: 2, c2: pe } });
  const next = applyChanges(v, changes);
  assert.equal(next.c!.periodAchievement, "8");
  assert.equal(next.b!.periodAchievement, "1");
  assert.equal(skippedLocked, 1);
  assert.deepEqual(planFillDown({ rows, values: base(), ctx, range: { r1: 0, c1: pe, r2: 0, c2: pe } }).changes, [], "one row has nothing to fill");
});

test("Delete empties editable cells and counts the values the server already holds", () => {
  const pe = col("periodAchievement");
  const v = { ...base(), a: vals({ periodAchievement: "10" }), b: vals({ periodAchievement: "5" }) };
  const initial = { ...base(), a: vals({ periodAchievement: "10" }) };
  const { changes, clearsSaved } = planClear({ rows, values: v, initial, ctx, range: { r1: 0, c1: col("code"), r2: 2, c2: pe } });
  assert.equal(clearsSaved, 1);
  const next = applyChanges(v, changes);
  assert.equal(next.a!.periodAchievement, "");
  assert.equal(next.b!.periodAchievement, "");
  assert.equal(planClear({ rows: [row("a", { update: { verificationStatus: "VERIFIED", updatedAt: "t" } })], values: v, initial, ctx, range: { r1: 0, c1: pe, r2: 0, c2: pe } }).changes.length, 0);
});

test("marking rows not applicable needs a reason, empties the figures (never 0) and skips locked and calculated rows", () => {
  const v: ValuesById = { a: vals({ periodAchievement: "10", cumulativeAchievement: "10" }), b: vals(), c: vals() };
  const r = [row("a"), row("b", { calculation: "x" }), row("c", { update: { verificationStatus: "VERIFIED", updatedAt: "t" } })];
  const changes = planNotApplicable({ rows: r, values: v, ctx, rowIds: ["a", "b", "c"], reason: "  Clinics closed  " });
  const next = applyChanges(v, changes);
  assert.deepEqual([next.a!.notApplicableReason, next.a!.periodAchievement, next.a!.cumulativeAchievement], ["Clinics closed", "", ""]);
  assert.equal(next.b!.notApplicableReason, "");
  assert.equal(next.c!.notApplicableReason, "");
  const cleared = planNotApplicable({ rows: r, values: next, ctx, rowIds: ["a"], reason: "" });
  assert.equal(applyChanges(next, cleared).a!.notApplicableReason, "");
});

test("undo and redo step through whole actions and restore exactly; a no-op is not a step; history is capped", () => {
  const pe = col("periodAchievement");
  let values = base();
  let h = emptyHistory();
  const act = (changes: ReturnType<typeof planEdit>) => { values = applyChanges(values, changes); h = recordChange(h, changes); };
  act(planEdit(rows[0]!, "periodAchievement", "10", values.a!));
  act(planPaste({ rows, values, ctx, anchor: { row: 1, col: pe }, text: "3\n4" }).changes);
  const afterPaste = JSON.stringify(values);
  h = recordChange(h, []);
  assert.equal(h.undo.length, 2, "an empty action is not recorded");
  const u1 = undoStep(h)!;
  values = applyChanges(values, u1.apply); h = u1.history;
  assert.equal(values.b!.periodAchievement, "");
  assert.equal(values.c!.periodAchievement, "");
  assert.equal(values.a!.periodAchievement, "10", "only the paste was undone");
  const r1 = redoStep(h)!;
  values = applyChanges(values, r1.apply); h = r1.history;
  assert.equal(JSON.stringify(values), afterPaste, "redo restores exactly");
  const u2 = undoStep(h)!; h = u2.history; values = applyChanges(values, u2.apply);
  const u3 = undoStep(h)!; h = u3.history; values = applyChanges(values, u3.apply);
  assert.deepEqual(values, base());
  assert.equal(undoStep(h), null);
  assert.equal(h.undo.length, 0);
  h = recordChange(h, planEdit(rows[0]!, "comments", "x", vals()));
  assert.equal(redoStep(h), null, "a new action clears redo");
  let many = emptyHistory();
  for (let i = 0; i < HISTORY_LIMIT + 20; i += 1) many = recordChange(many, [{ rowId: "a", column: "comments", before: String(i), after: String(i + 1) }]);
  assert.equal(many.undo.length, HISTORY_LIMIT);
  assert.deepEqual(invertChanges(invertChanges([{ rowId: "a", column: "comments", before: "x", after: "y" }])), [{ rowId: "a", column: "comments", before: "x", after: "y" }]);
});

test("a row is clean again when its values are back to what the server has", () => {
  const initial: ValuesById = { a: vals({ periodAchievement: "10" }), b: vals() };
  const typed = applyChanges(initial, planEdit(rows[0]!, "periodAchievement", "11", initial.a!));
  assert.deepEqual([...changedRowIds(initial, typed)], ["a"]);
  const back = applyChanges(typed, planEdit(rows[0]!, "periodAchievement", "10", typed.a!));
  assert.equal(changedRowIds(initial, back).size, 0);
  assert.equal(rowIsClean(vals({ notApplicableReason: " " }), vals()), true, "a blank reason is no reason");
  assert.equal(rowIsClean(vals({ disaggregation: [{ category: "F", value: "1" }] }), vals()), false);
});

test("the save is the form's own bulk save: version, trimmed reason, breakdown only when asked for, empty entries dropped", () => {
  const r = [
    row("a", { update: { verificationStatus: "DRAFT", updatedAt: "2026-10-01T00:00:00.000Z" } }),
    row("b", { disaggregationRequired: true }),
    row("c"),
    row("d"),
  ];
  const v = {
    a: vals({ periodAchievement: "10", notApplicableReason: " Closed " }),
    b: vals({ periodAchievement: "4", disaggregation: [{ category: "F", value: "3" }, { category: "", value: "" }, { category: "M", value: "1" }] }),
    c: vals({ comments: "n", disaggregation: [{ category: "F", value: "1" }] }),
    d: vals({ comments: "untouched" }),
  } as ValuesById<{ category: string; value: string }>;
  const plan = toWritePlan(r, v, new Set(["a", "b", "c"]));
  assert.deepEqual(plan.map((p) => p.indicatorId), ["a", "b", "c"], "only changed rows, in sheet order");
  assert.equal(plan[0]!.expectedUpdatedAt, "2026-10-01T00:00:00.000Z");
  assert.equal(plan[0]!.notApplicableReason, "Closed");
  assert.equal(plan[0]!.disaggregation, undefined);
  assert.equal("expectedUpdatedAt" in plan[1]!, false);
  assert.deepEqual(plan[1]!.disaggregation, [{ category: "F", value: "3" }, { category: "M", value: "1" }]);
  assert.deepEqual(plan[2]!.disaggregation, [{ category: "F", value: "1" }]);
  assert.equal(plan[0]!.cumulativeAchievement, "", "an empty value is sent empty, never 0");
});

test("the status line counts unsaved rows, invalid and empty figure cells, and locked rows", () => {
  const r = [row("a"), row("b"), row("c", { update: { verificationStatus: "VERIFIED", updatedAt: "t" } }), row("d")];
  const initial: ValuesById = { a: vals(), b: vals(), c: vals({ periodAchievement: "1" }), d: vals() };
  const v: ValuesById = { a: vals({ periodAchievement: "5" }), b: vals({ periodAchievement: "zzz" }), c: vals({ periodAchievement: "1" }), d: vals({ notApplicableReason: "n/a" }) };
  assert.deepEqual(summarise(r, v, initial, ctx), { rows: 4, unsavedRows: 3, invalidCells: 1, emptyCells: 2, lockedRows: 1 });
});

/* ---------- columns: hide, reorder, resize, earlier periods ---------- */

test("columns: the frozen two are never hidden or moved; hiding keeps at least one typed column; widths are clamped", () => {
  const prefs = emptyPrefs();
  assert.equal(resolveColumns(prefs).length, 11);
  assert.deepEqual(toggleColumn(prefs, "code"), prefs, "a frozen column cannot be hidden");
  let p = toggleColumn(prefs, "baseline");
  assert.deepEqual(resolveColumns(p).map((c) => c.key).includes("baseline"), false);
  p = toggleColumn(p, "baseline");
  assert.equal(resolveColumns(p).length, 11, "shown again");
  let q = prefs;
  for (const k of ["periodAchievement", "cumulativeAchievement", "comments", "dataSource"] as const) q = toggleColumn(q, k);
  assert.ok(resolveColumns(q).some((c) => c.editable), "one typed column always stays");
  assert.equal(resolveColumns(resizeColumn(prefs, "name", 5)).find((c) => c.key === "name")!.width, MIN_COLUMN_WIDTH);
  assert.equal(resolveColumns(resizeColumn(prefs, "name", 5000)).find((c) => c.key === "name")!.width, MAX_COLUMN_WIDTH);
  assert.equal(resolveColumns(resizeColumn(prefs, "comments", 300.4)).find((c) => c.key === "comments")!.width, 300);
});

test("columns can be moved among the movable ones and the order is remembered", () => {
  const cols = resolveColumns(emptyPrefs());
  const moved = moveColumn(emptyPrefs(), cols, "comments", -1);
  const keys = resolveColumns(moved).map((c) => c.key);
  assert.ok(keys.indexOf("comments") < keys.indexOf("cumulativeAchievement"));
  assert.deepEqual(keys.slice(0, 2), ["code", "name"]);
  assert.deepEqual(moveColumn(emptyPrefs(), cols, "baseline", -1), emptyPrefs(), "already first among the movable");
  assert.deepEqual(moveColumn(emptyPrefs(), cols, "code", 1), emptyPrefs(), "a frozen column does not move");
});

test("earlier periods are read-only columns of context; copying them gives their values", () => {
  const extra = historyColumns([{ id: "p1", label: "Jan" }, { id: "p2", label: "Feb" }]);
  const cols = resolveColumns(emptyPrefs(), extra);
  assert.equal(cols.length, 13);
  assert.ok(cols.filter((c) => c.key.startsWith("history:")).every((c) => !c.editable && !c.frozen));
  const lookup = (rowId: string, periodId: string) => (rowId === "a" && periodId === "p2" ? "42" : "");
  assert.equal(cellText(row("a"), "history:p2", vals(), lookup), "42");
  assert.equal(cellText(row("a"), "history:p1", vals(), lookup), "");
  assert.equal(cellText(row("a"), "history:p1", vals()), "");
  assert.equal(resolveColumns(toggleColumn(emptyPrefs(), "history:p1"), extra).length, 12, "a history column can be hidden");
});

test("with columns hidden or added, keys and paste follow the visible columns", () => {
  const cols = resolveColumns(toggleColumn(emptyPrefs(), "cumulativeAchievement"), historyColumns([{ id: "p1", label: "Jan" }]));
  const pe = cols.findIndex((c) => c.key === "periodAchievement");
  const b = editableBounds(cols);
  assert.equal(cols[b.first]!.key, "periodAchievement");
  assert.equal(cols[b.last]!.key, "dataSource");
  const dims = { rows: 3, cols: cols.length };
  assert.equal(moveSelection(selectionOf({ row: 0, col: b.last }), { key: "Tab" }, dims, cols)!.focus.col, b.first);
  const plan = planPaste({ rows, values: base(), ctx, anchor: { row: 0, col: pe }, text: "10\tnote\tsrc", columns: cols });
  const next = applyChanges(base(), plan.changes);
  assert.deepEqual([next.a!.periodAchievement, next.a!.comments, next.a!.dataSource], ["10", "note", "src"], "the hidden cumulative column is skipped");
  const clear = planClear({ rows, values: next, initial: base(), ctx, range: { r1: 0, c1: pe, r2: 0, c2: pe + 2 }, columns: cols });
  assert.equal(clear.changes.length, 3);
  const fill = planFillDown({ rows, values: next, ctx, range: { r1: 0, c1: pe, r2: 2, c2: pe }, columns: cols });
  assert.equal(applyChanges(next, fill.changes).c!.periodAchievement, "10");
});

test("saved preferences are read defensively, field by field", () => {
  assert.deepEqual(parseSheetPrefs(null), defaultSheetPrefs());
  assert.deepEqual(parseSheetPrefs("not json"), defaultSheetPrefs());
  assert.deepEqual(parseSheetPrefs("[]"), defaultSheetPrefs());
  const p = parseSheetPrefs(JSON.stringify({ columns: { hidden: ["baseline", 7], order: ["comments"], widths: { name: 9999, comments: "wide", target: 150.6 } }, density: "compact", zoom: 9, showRefs: true, autosave: false }));
  assert.deepEqual(p.columns.hidden, ["baseline"]);
  assert.equal(p.columns.widths.name, MAX_COLUMN_WIDTH);
  assert.equal(p.columns.widths.target, 151);
  assert.equal("comments" in p.columns.widths, false);
  assert.equal(p.density, "compact");
  assert.equal(p.zoom, ZOOM_MAX);
  assert.equal(p.showRefs, true);
  assert.equal(p.autosave, false);
  assert.equal(parseSheetPrefs(JSON.stringify({ zoom: 0.1, density: "huge" })).zoom, ZOOM_MIN);
  assert.equal(parseSheetPrefs(JSON.stringify({ density: "huge" })).density, "comfortable");
  assert.equal(parseSheetPrefs(JSON.stringify({})).autosave, true);
});

/* ---------- rows: filter, search, sort ---------- */

const wide: SheetRow[] = [
  row("a", { code: "OUT-2", name: "Kits distribuées" }),
  row("b", { code: "OUT-10", name: "People trained" }),
  row("c", { code: "OUT-1", name: "Verified", update: { verificationStatus: "VERIFIED", updatedAt: "t" } }),
  row("d", { code: "OUT-3", name: "Returned", update: { verificationStatus: "NEEDS_CORRECTION", updatedAt: "t" } }),
];
const wv = (): ValuesById => ({ a: vals(), b: vals({ periodAchievement: "5", cumulativeAchievement: "5" }), c: vals({ periodAchievement: "1", cumulativeAchievement: "1" }), d: vals({ periodAchievement: "x" }) });
const wi = (): ValuesById => ({ a: vals(), b: vals(), c: vals({ periodAchievement: "1", cumulativeAchievement: "1" }), d: vals() });
const ids = (filter: string, sort = "LEVEL", search = "") => viewRowIds({ rows: wide, values: wv(), initial: wi(), ctx, filter: filter as never, sort: sort as never, search });

test("row filters show what needs attention; search ignores case and accents; sorting is stable and natural", () => {
  assert.deepEqual(ids("ALL"), ["a", "b", "c", "d"]);
  assert.deepEqual(ids("EMPTY"), ["a", "d"]);
  assert.deepEqual(ids("UNSAVED"), ["b", "d"]);
  assert.deepEqual(ids("INVALID"), ["d"]);
  assert.deepEqual(ids("RETURNED"), ["d"]);
  assert.deepEqual(ids("LOCKED"), ["c"]);
  assert.deepEqual(ids("OPEN"), ["a", "b", "d"]);
  assert.deepEqual(ids("ALL", "LEVEL", "distribuees"), ["a"], "accents are ignored");
  assert.deepEqual(ids("ALL", "LEVEL", "OUT-1"), ["b", "c"]);
  assert.deepEqual(ids("ALL", "CODE"), ["c", "a", "d", "b"], "OUT-1, OUT-2, OUT-3, OUT-10: natural order");
  assert.deepEqual(ids("ALL", "NAME"), ["a", "b", "d", "c"]);
  assert.deepEqual(ids("ALL", "PERCENT"), ["a", "d", "c", "b"], "no percent sorts first, then 0.1%, then 0.5%");
  assert.deepEqual(ids("ALL", "STATUS"), ["a", "b", "d", "c"], "nothing entered, then returned, then verified");
  assert.deepEqual(ids("ALL", "LEVEL", "nothing like this"), []);
});

/* ---------- find and go to ---------- */

test("find walks the cells after the cursor, wraps, and can go backwards; go to takes a cell or a code", () => {
  const cols = resolveColumns(emptyPrefs());
  const v = { ...base(), b: vals({ comments: "Field visit done" }), c: vals({ comments: "field visit again" }) };
  const at = (row: number, col: number) => ({ row, col });
  const f = (query: string, from = at(0, 0), backwards = false) => findCell({ rows, columns: cols, values: v, query, from, backwards });
  assert.deepEqual(f("field visit"), at(1, col("comments")));
  assert.deepEqual(f("field visit", at(1, col("comments"))), at(2, col("comments")));
  assert.deepEqual(f("field visit", at(2, col("comments"))), at(1, col("comments")), "wraps round");
  assert.deepEqual(f("field visit", at(2, col("comments")), true), at(1, col("comments")));
  assert.deepEqual(f("indicator b"), at(1, col("name")), "finds names too");
  assert.equal(f("zzz"), null);
  assert.equal(f("  "), null);
  assert.deepEqual(goToCell({ rows: wide, columns: cols, text: "out-3" }), at(3, editableBounds(cols).first));
  assert.deepEqual(goToCell({ rows, columns: cols, text: "F3" }), at(2, 5));
  assert.deepEqual(goToCell({ rows, columns: cols, text: "aa1" }), null, "past the last column");
  assert.deepEqual(goToCell({ rows, columns: cols, text: "A99" }), null, "past the last row");
  assert.deepEqual(goToCell({ rows: wide, columns: cols, text: "OUT" }), at(0, editableBounds(cols).first), "a code prefix");
  assert.equal(goToCell({ rows, columns: cols, text: "" }), null);
});

/* ---------- drag fill ---------- */

test("dragging the fill handle copies the last selected row down, or the first up, skipping locked rows", () => {
  const pe = col("periodAchievement");
  const r = [row("a"), row("b"), row("c", { update: { verificationStatus: "VERIFIED", updatedAt: "t" } }), row("d")];
  const v: ValuesById = { a: vals(), b: vals({ periodAchievement: "8" }), c: vals({ periodAchievement: "1" }), d: vals() };
  const down = planFillTo({ rows: r, values: v, ctx, range: { r1: 1, c1: pe, r2: 1, c2: pe }, targetRow: 3 });
  const after = applyChanges(v, down.changes);
  assert.equal(after.c!.periodAchievement, "1");
  assert.equal(after.d!.periodAchievement, "8");
  assert.equal(down.skippedLocked, 1);
  const up = planFillTo({ rows: r, values: v, ctx, range: { r1: 1, c1: pe, r2: 1, c2: pe }, targetRow: 0 });
  assert.equal(applyChanges(v, up.changes).a!.periodAchievement, "8");
  assert.deepEqual(planFillTo({ rows: r, values: v, ctx, range: { r1: 1, c1: pe, r2: 1, c2: pe }, targetRow: 1 }).changes, [], "no drag, no fill");
  assert.deepEqual(planFillTo({ rows: r, values: v, ctx, range: { r1: 1, c1: pe, r2: 1, c2: pe }, targetRow: 99 }).changes.length > 0, true, "past the end stops at the last row");
});

/* ---------- by place ---------- */

test("by place: the breakdown's places come first, known places follow with no value, other dimensions are untouched", () => {
  const entries = [{ dimension: "SEX", category: "Female", value: "3" }, { dimension: "LOCATION", category: "Rabak", value: "10" }];
  assert.deepEqual(placeRows(entries, ["rabak", "Kosti", "Kosti", " "]), [{ place: "Rabak", value: "10" }, { place: "Kosti", value: "" }]);
  const next = withPlaceValues(entries, [{ place: "Rabak", value: "12" }, { place: "Kosti", value: "" }, { place: " New ", value: "4" }]);
  assert.deepEqual(next, [{ dimension: "SEX", category: "Female", value: "3" }, { dimension: "LOCATION", category: "Rabak", value: "12" }, { dimension: "LOCATION", category: "New", value: "4" }]);
  assert.deepEqual(withPlaceValues([], []), []);
});

test("pasting place and value lines fills known places, names new ones, and reports a value that is not a number", () => {
  const rows0 = [{ place: "Rabak", value: "" }, { place: "Kosti", value: "2" }];
  const r = planPlacePaste(rows0, "rabak\t1,200\nSinja\t7\nKosti\tmany\n\t5\nUm Gargur");
  assert.deepEqual(r.rows, [{ place: "Rabak", value: "1200" }, { place: "Kosti", value: "2" }, { place: "Sinja", value: "7" }, { place: "Um Gargur", value: "" }]);
  assert.deepEqual(r.added, ["Sinja", "Um Gargur"]);
  assert.equal(r.problems.length, 1);
  assert.match(r.problems[0]!, /Kosti.*many/);
  assert.deepEqual(rows0, [{ place: "Rabak", value: "" }, { place: "Kosti", value: "2" }], "the input is not changed");
});
