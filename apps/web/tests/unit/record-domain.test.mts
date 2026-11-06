import test from "node:test";
import assert from "node:assert/strict";
import { RECORD_KINDS, availableKinds, startingKind, packPartsFor } from "../../src/features/record/domain/record-kinds.ts";
import { chooseWorkOutcome, worksOffline } from "../../src/features/record/domain/work-outcome.ts";
import { ENTRY_ADVICE_RULES, adviceFor, savingIsBlocked } from "../../src/features/record/domain/entry-advice.ts";
import { DEFAULT_FIELDS, DEFAULT_FIELD_LIMIT } from "../../src/features/record/domain/default-fields.ts";
import { SYNC_STATES, stateOfEntry, progressOf, waitingOrder } from "../../src/features/record/domain/sync-words.ts";
import type { Capability } from "../../src/lib/shared/capabilities.ts";

// ---------- record kinds ----------
const caps = (...c: Capability[]) => (x: Capability) => c.includes(x);

test("every kind has a unique key, catalogue keys that follow its name and at least one capability", () => {
  const keys = RECORD_KINDS.map((k) => k.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const k of RECORD_KINDS) {
    assert.equal(k.labelKey, `record.kind.${k.key}`);
    assert.equal(k.hintKey, `record.kind.${k.key}.hint`);
    assert.ok(k.anyOf.length > 0);
  }
});

test("a kind marked as queued or packed names its outbox kind; online-only has none", () => {
  for (const k of RECORD_KINDS) assert.equal(k.offline === "ONLINE_ONLY", k.outboxKind === null, k.key);
});

test("availableKinds follows capabilities and hides the form kind when the project has no published form", () => {
  const field = availableKinds({ has: caps("indicator.update", "activity.create", "evidence.upload"), hasForms: false }).map((k) => k.key);
  assert.deepEqual(field, ["NUMBER", "ACTIVITY", "FILE"]);
  const withForms = availableKinds({ has: caps("indicator.update"), hasForms: true }).map((k) => k.key);
  assert.deepEqual(withForms, ["NUMBER", "FORM"]);
  assert.deepEqual(availableKinds({ has: caps(), hasForms: true }), []);
});

test("a viewer sees no kinds; the expense kind needs the plan-entry permission", () => {
  assert.equal(availableKinds({ has: caps("project.view" as Capability), hasForms: true }).length, 0);
  assert.deepEqual(availableKinds({ has: caps("workplan.update-own"), hasForms: false }).map((k) => k.key), ["EXPENSE"]);
});

test("startingKind remembers the last kind only while it is still allowed", () => {
  const a = availableKinds({ has: caps("indicator.update", "activity.create"), hasForms: false });
  assert.equal(startingKind(a, "ACTIVITY")?.key, "ACTIVITY");
  assert.equal(startingKind(a, "EXPENSE")?.key, "NUMBER");
  assert.equal(startingKind([], "NUMBER"), undefined);
});

test("the pack carries only what the person's kinds use", () => {
  const numbers = availableKinds({ has: caps("indicator.update"), hasForms: false });
  assert.deepEqual(packPartsFor(numbers).sort(), ["indicators", "periods"]);
  assert.deepEqual(packPartsFor([]), []);
});

// ---------- work outcome ----------
test("a thing done that was never planned is one new activity", () => {
  const r = chooseWorkOutcome({ choice: "UNPLANNED", hasDetail: false, online: true });
  assert.deepEqual(r, { ok: true, steps: [{ action: "CREATE_ACTIVITY", linkToPlan: false }] });
});

test("finished with only a day, people and a note uses the one-call completion", () => {
  const r = chooseWorkOutcome({ choice: "FINISHED", planStatus: "PLANNED", hasDetail: false, online: true });
  assert.deepEqual(r, { ok: true, steps: [{ action: "COMPLETE_PLANNED" }] });
  assert.equal(worksOffline((r as { steps: never[] }).steps), false);
});

test("finished with detail, or offline, is an activity linked to the plan plus a status step", () => {
  for (const input of [{ hasDetail: true, online: true }, { hasDetail: false, online: false }]) {
    const r = chooseWorkOutcome({ choice: "FINISHED", planStatus: "IN_PROGRESS", ...input });
    assert.deepEqual(r, { ok: true, steps: [{ action: "CREATE_ACTIVITY", linkToPlan: true }, { action: "CHANGE_STATUS", planAction: "COMPLETE" }] });
    assert.equal(r.ok && worksOffline(r.steps), true);
  }
});

test("some progress is saved, and starts a plan item that has not started", () => {
  const planned = chooseWorkOutcome({ choice: "PROGRESS", planStatus: "PLANNED", hasDetail: false, online: true });
  assert.deepEqual(planned, { ok: true, steps: [{ action: "SAVE_PROGRESS" }, { action: "CHANGE_STATUS", planAction: "START" }] });
  const going = chooseWorkOutcome({ choice: "PROGRESS", planStatus: "IN_PROGRESS", hasDetail: false, online: true });
  assert.deepEqual(going, { ok: true, steps: [{ action: "SAVE_PROGRESS" }] });
});

test("not held cancels with the reason, and needs one", () => {
  assert.deepEqual(chooseWorkOutcome({ choice: "NOT_HELD", planStatus: "PLANNED", hasDetail: false, online: true, reason: "Heavy rain" }),
    { ok: true, steps: [{ action: "CHANGE_STATUS", planAction: "CANCEL", reason: "Heavy rain" }] });
  assert.deepEqual(chooseWorkOutcome({ choice: "NOT_HELD", planStatus: "PLANNED", hasDetail: false, online: true, reason: "  " }), { ok: false, problem: "NEEDS_REASON" });
});

test("a plan item that is done or cancelled cannot be finished, progressed or cancelled again", () => {
  for (const choice of ["FINISHED", "PROGRESS", "NOT_HELD"] as const) {
    for (const planStatus of ["DONE", "CANCELLED"] as const) {
      assert.deepEqual(chooseWorkOutcome({ choice, planStatus, hasDetail: false, online: true, reason: "x" }), { ok: false, problem: "PLAN_ITEM_NOT_OPEN" }, `${choice}/${planStatus}`);
    }
  }
});

test("a planned answer without a plan item is refused", () => {
  for (const choice of ["FINISHED", "PROGRESS", "NOT_HELD"] as const) {
    assert.deepEqual(chooseWorkOutcome({ choice, hasDetail: false, online: true, reason: "x" }), { ok: false, problem: "NEEDS_PLAN_ITEM" });
  }
});

// ---------- entry advice ----------
const found = { kind: "FOUND", periodId: "p1", label: "November 2026", locked: false } as const;
const base = { today: "2026-11-06", date: "2026-11-06", landing: found } as const;

test("a clean entry has no notes", () => {
  assert.deepEqual(adviceFor({ ...base }), []);
});

test("each rule has its own test row: what it says and whether it stops the save", () => {
  const rows: Array<[string, Parameters<typeof adviceFor>[0], string, boolean]> = [
    ["bad day", { ...base, landing: { kind: "INVALID", message: "x" } }, "BAD_DAY", true],
    ["no period", { ...base, landing: { kind: "NONE", message: "x" } }, "NO_PERIOD_FOR_DAY", true],
    ["locked", { ...base, landing: { ...found, locked: true } }, "LOCKED_PERIOD", true],
    ["returned", { ...base, returnedReason: "Add the denominator" }, "RETURNED_NEEDS_CHANGE", false],
    ["breakdown", { ...base, indicator: { code: "WS-1", disaggregationRequired: true } }, "MISSING_BREAKDOWN", false],
    ["duplicate", { ...base, existingValue: { value: "310", by: "Amina" } }, "DUPLICATE_VALUE", false],
    ["file", { ...base, fileWanted: true, hasFile: false }, "MISSING_FILE", false],
    ["not due", { ...base, indicator: { code: "WS-2", dueInPeriod: false } }, "NOT_DUE", false],
    ["future", { ...base, date: "2026-11-09" }, "FUTURE_DATE", false],
  ];
  for (const [name, input, key, blocks] of rows) {
    const found = adviceFor(input).find((a) => a.key === key);
    assert.ok(found, `${name}: expected ${key}`);
    assert.equal(found!.blocksSave, blocks, `${name}: blocksSave`);
  }
  // every rule in the table is covered by a row above
  assert.deepEqual(new Set(rows.map((r) => r[2])), new Set(ENTRY_ADVICE_RULES.map((r) => r.key)));
});

test("a required breakdown that is complete, or a file that is there, raises no note", () => {
  assert.deepEqual(adviceFor({ ...base, indicator: { code: "WS-1", disaggregationRequired: true }, breakdownComplete: true }), []);
  assert.deepEqual(adviceFor({ ...base, fileWanted: true, hasFile: true }), []);
});

test("an unknown 'due' answer says nothing; only a plain false says not due", () => {
  assert.deepEqual(adviceFor({ ...base, indicator: { code: "WS-2" } }), []);
});

test("notes come in the order that stops a save first", () => {
  const keys = adviceFor({ ...base, landing: { ...found, locked: true }, date: "2026-11-09", existingValue: { value: "1" }, indicator: { code: "A", disaggregationRequired: true } }).map((a) => a.key);
  assert.deepEqual(keys, ["LOCKED_PERIOD", "MISSING_BREAKDOWN", "DUPLICATE_VALUE", "FUTURE_DATE"]);
});

test("only a refusal blocks saving, and the params carry the words the sentence needs", () => {
  assert.equal(savingIsBlocked(adviceFor({ ...base })), false);
  assert.equal(savingIsBlocked(adviceFor({ ...base, existingValue: { value: "1" }, date: "2026-11-09" })), false);
  assert.equal(savingIsBlocked(adviceFor({ ...base, landing: { kind: "NONE", message: "x" } })), true);
  const dup = adviceFor({ ...base, existingValue: { value: "310", by: "Amina" } })[0]!;
  assert.deepEqual(dup.params, { value: "310", by: "Amina" });
});

// ---------- default fields ----------
test("no kind shows more than five fields before Add detail", () => {
  for (const [kind, split] of Object.entries(DEFAULT_FIELDS)) {
    assert.ok(split.shown.length <= DEFAULT_FIELD_LIMIT, `${kind} shows ${split.shown.length}`);
    assert.equal(new Set([...split.shown, ...split.detail]).size, split.shown.length + split.detail.length, `${kind} repeats a field`);
  }
  assert.deepEqual(new Set(Object.keys(DEFAULT_FIELDS)), new Set(RECORD_KINDS.map((k) => k.key)));
});

// ---------- sync words ----------
test("no sync state is an error colour: having no signal is not a failure", () => {
  for (const s of Object.values(SYNC_STATES)) assert.notEqual((s.tone as string), "danger", s.key);
  for (const s of Object.values(SYNC_STATES)) assert.equal(s.labelKey, `record.sync.${s.key}`);
});

test("an entry that needs attention is 'needs you'; the one being sent is 'sending'; the rest wait", () => {
  assert.equal(stateOfEntry({ id: "a", state: "needs-attention" }, "a").key, "NEEDS_YOU");
  assert.equal(stateOfEntry({ id: "a", state: "waiting" }, "a").key, "SENDING");
  assert.equal(stateOfEntry({ id: "b", state: "waiting" }, "a").key, "WAITING");
  assert.equal(stateOfEntry({ id: "b", state: "waiting" }, null).key, "WAITING");
});

test("progress is clamped and never divides by zero", () => {
  assert.deepEqual(progressOf(2, 4), { done: 2, total: 4, percent: 50 });
  assert.deepEqual(progressOf(9, 4), { done: 4, total: 4, percent: 100 });
  assert.deepEqual(progressOf(-1, 4), { done: 0, total: 4, percent: 0 });
  assert.deepEqual(progressOf(0, 0), { done: 0, total: 0, percent: 0 });
});

test("the waiting list shows what needs the person first, then what is sending, then the rest oldest first", () => {
  const entries = [
    { id: "1", state: "waiting" as const, createdAt: 30 },
    { id: "2", state: "needs-attention" as const, createdAt: 40 },
    { id: "3", state: "waiting" as const, createdAt: 10 },
    { id: "4", state: "waiting" as const, createdAt: 20 },
  ];
  assert.deepEqual(waitingOrder(entries, "4").map((e) => e.id), ["2", "4", "3", "1"]);
  assert.deepEqual(entries.map((e) => e.id), ["1", "2", "3", "4"], "the input is not changed");
});

// ---------- record day and prefs ----------
import { dateForChoice, choiceForDate, dayBefore, isPlainDay, localPlainDay } from "../../src/features/record/domain/record-day.ts";
import { parseRecordPrefs, serializeRecordPrefs, startingProject } from "../../src/features/record/domain/record-prefs.ts";

test("days are plain: yesterday crosses month and year ends, and a bad day is left alone", () => {
  assert.equal(dayBefore("2026-11-01"), "2026-10-31");
  assert.equal(dayBefore("2026-03-01"), "2026-02-28");
  assert.equal(dayBefore("2024-03-01"), "2024-02-29");
  assert.equal(dayBefore("2026-01-01"), "2025-12-31");
  assert.equal(dayBefore("nope"), "nope");
  assert.equal(isPlainDay("2026-02-30"), false);
  assert.equal(isPlainDay("2026-11-06"), true);
});

test("a chip stands for a date, and a date finds its chip", () => {
  assert.equal(dateForChoice("today", "2026-11-06", "2020-01-01"), "2026-11-06");
  assert.equal(dateForChoice("yesterday", "2026-11-06", "2020-01-01"), "2026-11-05");
  assert.equal(dateForChoice("pick", "2026-11-06", "2020-01-01"), "2020-01-01");
  assert.equal(choiceForDate("2026-11-06", "2026-11-06"), "today");
  assert.equal(choiceForDate("2026-11-05", "2026-11-06"), "yesterday");
  assert.equal(choiceForDate("2026-10-01", "2026-11-06"), "pick");
});

test("today is the person's own calendar day, zero-padded", () => {
  assert.equal(localPlainDay(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
  assert.equal(localPlainDay(new Date(2026, 10, 6, 0, 1)), "2026-11-06");
});

test("remembered choices are read defensively", () => {
  assert.deepEqual(parseRecordPrefs(null), {});
  assert.deepEqual(parseRecordPrefs("not json"), {});
  assert.deepEqual(parseRecordPrefs('{"projectId":"p1","kind":"NUMBER"}'), { projectId: "p1", kind: "NUMBER" });
  assert.deepEqual(parseRecordPrefs('{"projectId":5,"kind":"MAGIC"}'), {});
  assert.deepEqual(parseRecordPrefs(serializeRecordPrefs({ projectId: "p2", kind: "FILE" })), { projectId: "p2", kind: "FILE" });
});

test("the project to open is the remembered one only while it still exists, else the only one", () => {
  assert.equal(startingProject([{ id: "a" }, { id: "b" }], "b"), "b");
  assert.equal(startingProject([{ id: "a" }, { id: "b" }], "gone"), undefined);
  assert.equal(startingProject([{ id: "a" }], "gone"), "a");
  assert.equal(startingProject([], undefined), undefined);
});
