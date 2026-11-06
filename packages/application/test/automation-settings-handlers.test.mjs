import test from "node:test";
import assert from "node:assert/strict";
import { TenantId, PlannedActivity } from "@donordesk/domain";
import { SetAutomationRuleSettingsHandler, GetAutomationHistoryHandler, ListAutomationRulesHandler, RunAutomationsHandler } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ctxFor = (userId, role) => ({ tenant: { tenantId, userId, role }, requestId: "r" });
const PM = ctxFor("pm", "PROJECT_MANAGER");
const FIELD = ctxFor("fo", "FIELD_OFFICER");
const ok = (value) => ({ ok: true, value });

function settingsWorld() {
  const stored = {};
  const audit = [];
  const ruleSettings = {
    storedSettings: async () => ok(stored),
    setSettings: async (_p, rule, values) => (stored[rule] = values, ok(undefined)),
  };
  const clock = { now: () => new Date("2026-10-20T07:00:00Z") };
  return { stored, audit, ruleSettings, set: new SetAutomationRuleSettingsHandler(ruleSettings, { record: async (e) => void audit.push(e) }, clock) };
}

test("only a manager sets a rule's numbers; they are checked against the rule's range, stored and audited", async () => {
  const w = settingsWorld();
  assert.equal((await w.set.handle(FIELD, "p", "START_WITHOUT_LEAD", { days: 7 })).error.code, "FORBIDDEN");
  assert.equal((await w.set.handle(PM, "p", "NOT_A_RULE", { days: 7 })).ok, false);
  assert.equal((await w.set.handle(PM, "p", "START_WITHOUT_LEAD", { days: 99 })).ok, false);
  assert.deepEqual(w.stored, {}, "nothing stored on refusal");
  assert.deepEqual((await w.set.handle(PM, "p", "START_WITHOUT_LEAD", { days: 7 })).value, { days: 7 });
  assert.deepEqual(w.stored.START_WITHOUT_LEAD, { days: 7 });
  assert.equal(w.audit.filter((e) => e.eventType === "workplan.automation_settings_set").length, 1);
});

test("the rule list shows each rule's numbers with the value in force: the stored one, or the default", async () => {
  const w = settingsWorld();
  await w.set.handle(PM, "p", "START_WITHOUT_LEAD", { days: 7 });
  const list = new ListAutomationRulesHandler({ stored: async () => ok({}) }, w.ruleSettings);
  const rules = (await list.handle(PM, "p")).value;
  const start = rules.find((r) => r.ruleKey === "START_WITHOUT_LEAD");
  const files = rules.find((r) => r.ruleKey === "FILES_STILL_NEEDED");
  assert.deepEqual([start.settings[0].value, start.settings[0].default, start.settings[0].min, start.settings[0].max], [7, 3, 1, 14]);
  assert.equal(files.settings[0].value, 14, "no stored number means the default");
});

test("the run uses a project's stored number: a start a week away is only noticed when the project asked for a week", async () => {
  const item = PlannedActivity.create({ id: "a1", tenantId: "tenant-a", projectId: "p", title: "Training", plannedStart: "2026-10-27", plannedEnd: "2026-10-28", createdById: "pm" }).value;
  const make = (ruleSettings) => {
    const sent = [];
    const ledger = { wasSent: async () => ok(false), record: async () => ok(undefined) };
    const run = new RunAutomationsHandler(
      { listByTenant: async () => ok([{ id: "p" }]) }, { findByProject: async () => ok([item]) }, { factsByPlannedActivity: async () => ok(new Map()) },
      { stored: async () => ok({}), enabledRules: async () => ok(new Set()) }, { projectManagers: async () => ok(new Map([["p", "manager"]])) },
      ledger, { send: async (m) => void sent.push(m) }, ruleSettings);
    return { sent, run };
  };
  const plain = make(undefined);
  assert.equal((await plain.run.runFor(PM, "2026-10-20")).value, 0, "default is 3 days");
  const week = make({ storedSettings: async () => ok({ START_WITHOUT_LEAD: { days: 10 } }) });
  assert.equal((await week.run.runFor(PM, "2026-10-20")).value, 1);
  assert.equal(week.sent[0].recipientId, "manager");
});

test("the history reads the rule's words and the activity's title; only managers see it; unknown rules and removed activities are handled", async () => {
  const item = PlannedActivity.create({ id: "a1", tenantId: "tenant-a", projectId: "p", title: "Training", plannedStart: "2026-10-27", plannedEnd: "2026-10-28", createdById: "pm" }).value;
  const rows = [
    { sentOn: "2026-10-20", ruleKey: "START_WITHOUT_LEAD", itemId: "a1", recipientId: "manager" },
    { sentOn: "2026-10-19", ruleKey: "FILES_STILL_NEEDED", itemId: "gone", recipientId: "fo" },
    { sentOn: "2026-10-18", ruleKey: "OLD_RULE", itemId: "a1", recipientId: "fo" },
  ];
  const handler = new GetAutomationHistoryHandler({ recent: async (_p, _t, limit) => ok(rows.slice(0, limit)) }, { findByProject: async () => ok([item]) });
  assert.equal((await handler.handle(FIELD, "p")).error.code, "FORBIDDEN");
  const lines = (await handler.handle(PM, "p")).value;
  assert.equal(lines.length, 2, "a rule that no longer exists is left out");
  assert.deepEqual([lines[0].activity, lines[0].recipientId], ["Training", "manager"]);
  assert.match(lines[0].rule, /starts soon with no lead/);
  assert.equal(lines[1].activity, "An activity that was removed");
});
