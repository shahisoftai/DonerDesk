// Phase 38.7: the Reporting schedule slide's pure rules.
import test from "node:test";
import assert from "node:assert/strict";
import { ALL_REPORT_TYPES } from "@donordesk/domain";
import { CADENCES, CADENCE_LABEL, REPORT_TYPES, SHOWN_PERIODS, addableTypes, formatDay, removeRule, reportTypeLabel, ruleGaps, shownPeriods, upsertRule } from "../../src/features/project-setup/pcw/domain/schedule-view.ts";
import { PCW_COPY } from "../../src/features/project-setup/pcw/copy.ts";
import { findRawTokens } from "@donordesk/domain/core/copy-lint.js";

const rule = (reportType: string, extra = {}) => ({ reportType, template: "BUILT_IN", dueDaysAfterEnd: 30, ...extra });

test("the report types offered are exactly the real ones, each with a name", () => {
  assert.deepEqual([...REPORT_TYPES].sort(), [...ALL_REPORT_TYPES].sort());
  for (const t of REPORT_TYPES) assert.deepEqual(findRawTokens(reportTypeLabel(t)), [], t);
  assert.deepEqual([...CADENCES].sort(), ["ANNUAL", "MONTHLY", "QUARTERLY", "SEMI_ANNUAL"]);
});

test("a new kind of report starts empty, a change touches only that kind, and a removal removes only it", () => {
  const added = upsertRule([rule("QUARTERLY")], "FINAL");
  assert.deepEqual(added[1], { reportType: "FINAL", template: "BUILT_IN", dueDaysAfterEnd: null });
  const changed = upsertRule(added, "FINAL", { dueDaysAfterEnd: 60 });
  assert.equal(changed[0]!.dueDaysAfterEnd, 30);
  assert.equal(changed[1]!.dueDaysAfterEnd, 60);
  assert.deepEqual(removeRule(changed, "FINAL").map((r) => r.reportType), ["QUARTERLY"]);
  assert.equal(JSON.stringify(added).includes("60"), false, "the list given is not changed");
});

test("a kind of report already listed is not offered again", () => {
  assert.equal(addableTypes([rule("QUARTERLY")]).includes("QUARTERLY"), false);
  assert.equal(addableTypes([]).length, ALL_REPORT_TYPES.length);
});

test("what a rule still lacks is said in words: only the layout and the due date, since approval follows roles", () => {
  assert.deepEqual(ruleGaps({ reportType: "X", template: null, dueDaysAfterEnd: null }), ["a layout", "a due date"]);
  assert.deepEqual(ruleGaps(rule("X")), []);
  assert.deepEqual(ruleGaps(rule("X", { dueDaysAfterEnd: 0 })), [], "zero days is an answer");
});

test("dates read the same in every browser, and a bad one is shown as it is", () => {
  assert.equal(formatDay("2026-04-30"), "30 Apr 2026");
  assert.equal(formatDay("not a date"), "not a date");
});

test("a long calendar shows its first periods and counts the rest", () => {
  const periods = Array.from({ length: 30 }, (_, i) => ({ reportType: "MONTHLY", startDate: `2026-01-${String(i + 1).padStart(2, "0")}`, endDate: "2026-02-01", dueDate: null, closing: false }));
  const shown = shownPeriods({ timeline: { periods } } as never);
  assert.equal(shown.rows.length, SHOWN_PERIODS);
  assert.equal(shown.hidden, 30 - SHOWN_PERIODS);
  assert.equal(shownPeriods({ timeline: { periods: [] } } as never).hidden, 0);
});

test("the words on this slide are plain language", () => {
  const c = PCW_COPY.reporting;
  const texts = [...Object.values(c).filter((v): v is string => typeof v === "string"), c.more(3), c.dueLine("30 Apr 2026"), ...Object.values(CADENCE_LABEL)];
  for (const t of texts) assert.deepEqual(findRawTokens(t), [], t);
});
