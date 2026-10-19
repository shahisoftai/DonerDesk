import test from "node:test";
import assert from "node:assert/strict";
import { automationNotices, AUTOMATION_RULES, AUTOMATION_RULE_KEYS, noticeSubjectKey } from "../dist/index.js";

const item = (extra = {}) => ({ id: "a1", title: "Training", status: "PLANNED", plannedStart: "2026-10-22", plannedEnd: "2026-10-23", stillNeeded: [], ...extra });
const ON = new Set(AUTOMATION_RULE_KEYS);

test("a rule is only run when it is on", () => {
  assert.deepEqual(automationNotices([item()], "2026-10-20", new Set()), []);
  assert.equal(automationNotices([item()], "2026-10-20", ON).length, 1);
});

test("an activity that starts within three days with no lead goes to the manager; one further out does not", () => {
  const soon = automationNotices([item()], "2026-10-20", ON);
  assert.equal(soon[0].recipient, "MANAGER");
  assert.match(soon[0].message, /starts in 2 days/);
  assert.equal(automationNotices([item()], "2026-10-10", ON).length, 0);
  assert.equal(automationNotices([item({ ownerUserId: "amina" })], "2026-10-20", ON).length, 0, "a lead is set");
  assert.match(automationNotices([item()], "2026-10-22", ON)[0].message, /starts today/);
});

test("a finished activity that still needs files goes to its lead for two weeks, and is quiet afterwards", () => {
  const done = item({ status: "DONE", ownerUserId: "amina", stillNeeded: ["Photos", "Receipts"] });
  const [n] = automationNotices([done], "2026-10-25", ON);
  assert.equal(n.recipient, "LEAD");
  assert.match(n.message, /Photos, Receipts/);
  assert.equal(automationNotices([done], "2026-11-10", ON).length, 0, "more than two weeks after the end");
  assert.equal(automationNotices([{ ...done, stillNeeded: [] }], "2026-10-25", ON).length, 0);
});

test("each notice has a key per item per rule, so the ledger stops a repeat on the same day", () => {
  const [n] = automationNotices([item()], "2026-10-20", ON);
  assert.equal(noticeSubjectKey(n), "automation:START_WITHOUT_LEAD:a1");
  assert.deepEqual(AUTOMATION_RULE_KEYS, ["START_WITHOUT_LEAD", "FILES_STILL_NEEDED"]);
  assert.equal(AUTOMATION_RULES.FILES_STILL_NEEDED.defaultOn, true);
});
