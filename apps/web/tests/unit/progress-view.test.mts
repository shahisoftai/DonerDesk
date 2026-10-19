import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultKey, draftFor, reachedSoFar, keyOf, type ProgressEntryView } from "../../src/features/workplan/domain/progress-view.ts";

const act = { start: "2026-10-14", end: "2026-11-20" };
const fields = [{ key: "SEX|women", label: "Women", usedBy: ["1.1"] }, { key: "SEX|men", label: "Men", usedBy: ["1.1"] }];
const narr = { notes: "", summary: "", achievements: "", challenges: "", nextSteps: "", lessons: "" };
const entry = (id: string, kind: ProgressEntryView["kind"], from: string, to: string, total: number | null, women: number | null = null, absorbedById: string | null = null): ProgressEntryView => ({
  id, kind, from, to, values: { total, breakdowns: { "SEX|women": women, "SEX|men": null }, sessions: null, unique: null }, narrative: narr, absorbedById,
});

test("a form opens on today inside the activity: the day, its Monday, its month", () => {
  assert.equal(defaultKey("DAILY", "2026-10-20", act), "2026-10-20");
  assert.equal(defaultKey("DAILY", "2026-09-01", act), "2026-10-14");
  assert.equal(defaultKey("WEEKLY", "2026-10-21", act), "2026-10-19");
  assert.equal(defaultKey("MONTHLY", "2026-10-21", act), "2026-10");
  assert.equal(defaultKey("END", "2026-10-21", act), "");
});

test("a monthly form is filled from the daily entries in the month; a figure nobody recorded stays blank", () => {
  const entries = [entry("d1", "DAILY", "2026-10-14", "2026-10-14", 8, 3), entry("d2", "DAILY", "2026-10-15", "2026-10-15", 9)];
  const d = draftFor("MONTHLY", "2026-10", act, entries, fields);
  assert.equal(d.total, "17");
  assert.equal(d.breakdowns["SEX|women"], "3");
  assert.equal(d.breakdowns["SEX|men"], "", "blank, not 0");
  assert.match(d.note, /Filled from 2 entries/);
});

test("logging a saved day opens that entry; a day inside a monthly report is refused with a reason", () => {
  const day = entry("d1", "DAILY", "2026-10-14", "2026-10-14", 8, 3);
  assert.equal(draftFor("DAILY", "2026-10-14", act, [day], fields).editingId, "d1");
  const month = entry("m1", "MONTHLY", "2026-10-14", "2026-10-31", 20);
  const absorbedDay = { ...day, absorbedById: "m1" };
  assert.match(draftFor("DAILY", "2026-10-14", act, [month, absorbedDay], fields).error ?? "", /already reported/);
  assert.match(draftFor("DAILY", "2026-10-20", act, [month], fields).error ?? "", /already reported/, "also a day with no entry of its own");
});

test("a week that crosses a month end is explained, and a day outside the activity is refused", () => {
  assert.match(draftFor("WEEKLY", "2026-10-26", act, [], fields).error ?? "", /next month/);
  assert.match(draftFor("DAILY", "2026-10-01", act, [], fields).error ?? "", /inside the activity/);
});

test("people reached counts live entries only, and is blank when nothing is recorded", () => {
  assert.equal(reachedSoFar([]), null);
  const entries = [entry("d1", "DAILY", "2026-10-14", "2026-10-14", 8, null, "m1"), entry("m1", "MONTHLY", "2026-10-14", "2026-10-31", 20), entry("e1", "END", "2026-10-14", "2026-11-20", 99)];
  assert.equal(reachedSoFar(entries), 20, "the absorbed day and the end report are not added again");
  assert.equal(keyOf(entries[1]!), "2026-10");
  assert.equal(keyOf(entries[2]!), "");
});

test("the activity-end form starts unique people from the people linked by case code; none linked leaves it blank", () => {
  const entries = [entry("m1", "MONTHLY", "2026-10-14", "2026-10-31", 20)];
  const withPeople = draftFor("END", "", act, entries, fields, 12);
  assert.equal(withPeople.unique, "12");
  assert.match(withPeople.note, /12 linked/);
  assert.equal(draftFor("END", "", act, entries, fields, null).unique, "");
  assert.equal(draftFor("END", "", act, entries, fields, 0).unique, "", "none linked is not zero people");
});
