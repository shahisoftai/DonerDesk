import { test } from "node:test";
import assert from "node:assert/strict";
import { csvCell, planCsv, fieldChips } from "../../src/features/workplan/domain/plan-export.ts";

test("a cell is quoted when needed, and anything a spreadsheet would run as a formula is written as text", () => {
  assert.equal(csvCell("plain"), "plain");
  assert.equal(csvCell('say "hi", ok'), '"say ""hi"", ok"');
  assert.equal(csvCell("line\nbreak"), '"line\nbreak"');
  assert.equal(csvCell("=HYPERLINK(\"http://x\")"), '"\'=HYPERLINK(""http://x"")"');
  assert.equal(csvCell("+1"), "'+1");
  assert.equal(csvCell("@cmd"), "'@cmd");
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(0), "0");
});

test("the plan exports one row per activity with the lead's name, waits, and each custom field; blank stays blank", () => {
  const rows = [
    { id: "b", title: "Clinic", kind: "ACTIVITY", plannedStart: "2026-11-02", plannedEnd: "2026-11-03", status: "PLANNED", signalLabel: "On time", ownerUserId: "u1", location: "Ward 3", waitingFor: [{ title: "Training" }] },
    { id: "a", title: "Training", kind: "MILESTONE", plannedStart: "2026-10-20", plannedEnd: "2026-10-20", status: "DONE", signalLabel: "Done", waitingFor: [] },
  ];
  const csv = planCsv({ rows, fields: [{ id: "f1", label: "Donor code" }], values: { b: { f1: "X1" } }, names: { u1: "Amina K." } });
  const lines = csv.trim().split("\r\n");
  assert.equal(lines[0], "Activity,Type,Starts,Ends,Status,Signal,Lead,Location,Waiting for,Donor code");
  assert.equal(lines[1], "Training,Milestone,2026-10-20,2026-10-20,Done,Done,,,,", "sorted by start; no lead and no field value are empty cells");
  assert.equal(lines[2], "Clinic,Activity,2026-11-02,2026-11-03,Not started,On time,Amina K.,Ward 3,Training,X1");
});

test("a field chip is shown only for a field with a value", () => {
  const fields = [{ id: "f1", label: "Donor code" }, { id: "f2", label: "Phase" }];
  assert.deepEqual(fieldChips(fields, { f1: "X1" }), ["Donor code: X1"]);
  assert.deepEqual(fieldChips(fields, undefined), []);
  assert.deepEqual(fieldChips(fields, { f1: "" }), []);
});

import { minorToDecimal } from "../../src/features/workplan/domain/plan-export.ts";

test("budget and spending are added per currency; an activity with no budget in a currency has empty cells, never zeros", () => {
  const rows = [
    { id: "a", title: "Training", kind: "ACTIVITY", plannedStart: "2026-10-20", plannedEnd: "2026-10-21", status: "PLANNED", signalLabel: "On time", waitingFor: [] },
    { id: "b", title: "Radio", kind: "ACTIVITY", plannedStart: "2026-11-01", plannedEnd: "2026-11-02", status: "PLANNED", signalLabel: "On time", waitingFor: [] },
  ];
  const csv = planCsv({
    rows, fields: [], values: {}, names: {},
    budget: [
      { currency: "EUR", byActivity: [{ activityId: "b", budgetedMinor: 20000, spentMinor: 0 }] },
      { currency: "USD", byActivity: [{ activityId: "a", budgetedMinor: 125050, spentMinor: 5 }] },
    ],
  });
  const lines = csv.trim().split("\r\n");
  assert.equal(lines[0], "Activity,Type,Starts,Ends,Status,Signal,Lead,Location,Waiting for,Budget (EUR),Spent (EUR),Budget (USD),Spent (USD)");
  assert.equal(lines[1], "Training,Activity,2026-10-20,2026-10-21,Not started,On time,,,,,,1250.50,0.05");
  assert.equal(lines[2], "Radio,Activity,2026-11-01,2026-11-02,Not started,On time,,,,200.00,0.00,,", "spent 0 is a real zero; no budget is blank");
  assert.equal(minorToDecimal(-2050), "-20.50");
});
