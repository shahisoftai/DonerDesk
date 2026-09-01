import assert from "node:assert/strict";
import test from "node:test";
import { parsePeriodValueRows } from "../dist/contexts/reporting/period-value-import.js";
import { proposeFieldReportExtraction } from "../dist/contexts/reporting/field-report-extraction.js";

/**
 * Increment 5 — Flexible Inputs. Parsing/mapping is conservative and never
 * invents or silently drops values. Output feeds the existing structured model.
 */

test("Increment5 CSV: detects code+achievement columns and maps rows", () => {
  const rows = [
    ["Indicator code", "Period achievement"],
    ["OUT-1", "30"],
    ["OUT-2", "4500"],
    ["OUT-3", "52"],
  ];
  const r = parsePeriodValueRows(rows);
  assert.equal(r.unmappedCount, 0);
  assert.equal(r.columns.code, "Indicator code");
  assert.equal(r.columns.achievement, "Period achievement");
  assert.deepEqual(r.rows.map((x) => [x.indicatorCode, x.periodAchievement]), [["OUT-1", "30"], ["OUT-2", "4500"], ["OUT-3", "52"]]);
  assert.ok(r.rows.every((x) => x.valid));
});

test("Increment5 CSV: flags unmappable rows (non-numeric, missing code) and keeps them", () => {
  const rows = [
    ["Indicator code", "Period achievement"],
    ["OUT-1", "30"],
    ["OUT-2", "lots"],
    ["", "100"],
  ];
  const r = parsePeriodValueRows(rows);
  assert.equal(r.unmappedCount, 2);
  const bad = r.rows.filter((x) => !x.valid);
  assert.ok(bad.some((x) => x.indicatorCode === "OUT-2" && /not a number/.test(x.error)));
  assert.ok(bad.some((x) => x.indicatorCode === "" && /No indicator code/.test(x.error)));
});

test("Increment5 CSV: no header -> positional mapping", () => {
  const r = parsePeriodValueRows([["OUT-1", "30"], ["OUT-2", "4500"]]);
  assert.equal(r.rows.length, 2);
  assert.deepEqual(r.rows.map((x) => [x.indicatorCode, x.periodAchievement]), [["OUT-1", "30"], ["OUT-2", "4500"]]);
});

test("Increment5 field report: extracts indicator code + number as FOUND", () => {
  const r = proposeFieldReportExtraction("OUT-1 reached 30 centres this quarter.\nOUT-2 distributed 4500 kits.");
  assert.equal(r.indicatorAchievements.length, 2);
  assert.ok(r.indicatorAchievements.every((i) => i.certainty === "FOUND"));
  assert.deepEqual(r.indicatorAchievements.map((i) => [i.indicatorCode, i.value]), [["OUT-1", "30"], ["OUT-2", "4500"]]);
});

test("Increment5 field report: never invents a value with no code+number", () => {
  const r = proposeFieldReportExtraction("The team did great work this quarter overall. Delivered excellent results. No numbers here.");
  assert.equal(r.indicatorAchievements.length, 0, "no code+number => no proposed indicator values");
  // A "delivered" achievement line is SUGGESTED story, not a fabricated number.
  assert.ok(r.story.some((s) => s.field === "achievements"));
});

test("Increment5 field report: challenge/variance/language stays conservative (SUGGESTED)", () => {
  const r = proposeFieldReportExtraction("Flooding delayed access to three communities for three weeks.");
  assert.ok(r.story.some((s) => s.field === "challenges" && s.certainty === "SUGGESTED"));
});
