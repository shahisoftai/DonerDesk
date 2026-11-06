import test from "node:test";
import assert from "node:assert/strict";
import { launchDeadlineOffset, scheduleTimeline, cadenceOf, applyOperation, emptyDraft, evaluateRequirements, SETUP_REQUIREMENTS, gapInbox } from "../dist/index.js";

const item = (value) => ({ value, sourceQuote: null, sourceRef: null, confidence: "HIGH", status: "EDITED" });
const person = (key, role = "FIELD_OFFICER") => ({ key, name: key, email: null, role, external: false, invite: "LATER" });

function draft(cadence = "QUARTERLY") {
  const d = emptyDraft();
  d.proposal.facts.startDate = item("2026-01-01");
  d.proposal.facts.endDate = item("2026-12-31");
  d.extras.schedule.cadence = cadence;
  d.extras.team = [person("pm", "PROJECT_MANAGER"), person("me", "ME_OFFICER")];
  return d;
}

test("the calendar is the same one 'create all periods' makes: quarterly blocks, the last being the final report", () => {
  const t = scheduleTimeline(draft());
  assert.equal(t.note, undefined);
  assert.deepEqual(t.periods.map((p) => [p.reportType, p.startDate, p.endDate, p.closing]), [
    ["QUARTERLY", "2026-01-01", "2026-03-31", false],
    ["QUARTERLY", "2026-04-01", "2026-06-30", false],
    ["QUARTERLY", "2026-07-01", "2026-09-30", false],
    ["FINAL", "2026-10-01", "2026-12-31", true],
  ]);
});

test("a due date comes from the report type's own rule; none until a rule says", () => {
  const d = draft();
  assert.ok(scheduleTimeline(d).periods.every((p) => p.dueDate === null));
  d.extras.schedule.rules = [{ reportType: "QUARTERLY", template: "BUILT_IN", dueDaysAfterEnd: 30 }, { reportType: "FINAL", template: "BUILT_IN", dueDaysAfterEnd: 60 }];
  const t = scheduleTimeline(d);
  assert.equal(t.periods[0].dueDate, "2026-04-30");
  assert.equal(t.periods.at(-1).dueDate, "2027-03-01");
});

test("monthly gives twelve blocks; the cadence a document stated is used until the person chooses", () => {
  assert.equal(scheduleTimeline(draft("MONTHLY")).periods.length, 12);
  const d = draft();
  delete d.extras.schedule.cadence;
  assert.equal(cadenceOf(d), undefined);
  d.proposal.periods = [{ value: { type: "MONTHLY", start: null, end: null }, sourceQuote: "monthly", sourceRef: null, confidence: "HIGH", status: "ACCEPTED" }];
  assert.equal(cadenceOf(d), "MONTHLY");
  assert.equal(scheduleTimeline(d).periods.length, 12);
});

test("without dates, without a cadence or with a roll-up cadence the calendar is empty and says why", () => {
  assert.match(scheduleTimeline(emptyDraft()).note, /start and end dates/);
  const noCadence = draft(); delete noCadence.extras.schedule.cadence;
  assert.match(scheduleTimeline(noCadence).note, /Choose how often/);
  assert.match(scheduleTimeline(draft("ANNUAL")).note, /no fixed calendar/);
  const backwards = draft(); backwards.proposal.facts.endDate = item("2025-01-01");
  assert.match(scheduleTimeline(backwards).note, /start and end dates/);
});

test("the schedule edit checks the cadence, the report types and the days", () => {
  const d = draft();
  const rule = (extra = {}) => ({ reportType: "QUARTERLY", template: "BUILT_IN", dueDaysAfterEnd: 30, ...extra });
  const set = (patch) => applyOperation(d, { kind: "SET_SCHEDULE", patch });
  assert.equal(set({ cadence: "WEEKLY" }).ok, false);
  assert.equal(set({ cadence: "SEMI_ANNUAL" }).ok, true);
  assert.equal(set({ rules: [rule({ reportType: "DAILY" })] }).ok, false);
  assert.match(set({ rules: [rule(), rule()] }).reason, /listed once/);
  assert.match(set({ rules: [rule({ dueDaysAfterEnd: 400 })] }).reason, /0 to 365/);
  assert.equal(set({ rules: [rule()] }).ok, true);
  assert.equal(set({ reminders: false }).draft.extras.schedule.reminders, false);
});

test("the reporting requirements close from the slide's decisions", () => {
  const open = (x) => gapInbox(evaluateRequirements(x, SETUP_REQUIREMENTS)).map((r) => r.key).filter((k) => k.startsWith("reporting."));
  const d = draft();
  assert.deepEqual(open(d), ["reporting.rules"]);
  const done = applyOperation(d, { kind: "SET_SCHEDULE", patch: { rules: [{ reportType: "QUARTERLY", template: "BUILT_IN", dueDaysAfterEnd: 30 }] } }).draft;
  assert.deepEqual(open(done), []);
  const incomplete = applyOperation(d, { kind: "SET_SCHEDULE", patch: { rules: [{ reportType: "QUARTERLY", template: "BUILT_IN", dueDaysAfterEnd: null }] } }).draft;
  assert.deepEqual(open(incomplete), ["reporting.rules"]);
});

test("the timeline is pure: the draft it reads is not changed", () => {
  const d = draft();
  const before = JSON.stringify(d);
  scheduleTimeline(d);
  assert.equal(JSON.stringify(d), before);
});

test("Launch writes the cadence report type's due days, and nothing when no rule or cadence says", () => {
  const d = draft("MONTHLY");
  assert.equal(launchDeadlineOffset(d), null, "no rule: the organisation's default stays");
  d.extras.schedule.rules = [{ reportType: "MONTHLY", template: "BUILT_IN", dueDaysAfterEnd: 15 }, { reportType: "FINAL", template: "BUILT_IN", dueDaysAfterEnd: 60 }];
  assert.equal(launchDeadlineOffset(d), 15, "the monthly rule, not the final report's");
  d.extras.schedule.cadence = "SEMI_ANNUAL";
  assert.equal(launchDeadlineOffset(d), null, "a cadence without a fixed calendar has no offset");
});
