import test from "node:test";
import assert from "node:assert/strict";
import { TenantId, PlannedActivity } from "@donordesk/domain";
import { RegisterBeneficiaryHandler, ImportSubmissionsHandler, ListBeneficiariesHandler, GetWorkloadHandler, RunAutomationsHandler, SetAutomationRuleHandler, PlanAccess } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ctxFor = (userId, role) => ({ tenant: { tenantId, userId, role }, requestId: "r" });
const PM = ctxFor("pm", "PROJECT_MANAGER");
const FIELD = ctxFor("fo", "FIELD_OFFICER");
const OUTSIDER = ctxFor("me", "FIELD_OFFICER");
const ok = (value) => ({ ok: true, value });

function beneficiaryWorld() {
  const rows = [];
  let n = 0;
  const repo = {
    add: async (r) => (rows.push(r), ok(undefined)),
    addMany: async (list) => (rows.push(...list), ok(undefined)),
    findByProject: async (p) => ok(rows.filter((r) => r.projectId === p)),
  };
  const context = { activeMemberIds: async () => ok(new Set(["pm", "fo"])) };
  const audit = [];
  const ids = { generate: () => `b${++n}` };
  const clock = { now: () => new Date("2026-10-19T09:00:00Z") };
  const auditLogger = { record: async (e) => void audit.push(e) };
  const register = new RegisterBeneficiaryHandler(repo, context, ids, auditLogger, clock);
  const importer = new ImportSubmissionsHandler(repo, context, ids, auditLogger, clock);
  const list = new ListBeneficiariesHandler(repo, context);
  return { rows, audit, register, importer, list };
}

const person = { caseCode: "NG-0001", sex: "FEMALE", ageGroup: "UNDER_5", location: "Ward 3", enrolledOn: "2026-10-14", consentRecorded: true };

test("a field officer on the project registers a person by case code; a stranger and a repeat code are refused", async () => {
  const w = beneficiaryWorld();
  assert.equal((await w.register.handle(OUTSIDER, "p", person)).ok, false, "not a member of the project");
  assert.equal((await w.register.handle(FIELD, "p", { ...person, consentRecorded: false })).ok, false, "no consent, no record");
  const first = await w.register.handle(FIELD, "p", person);
  assert.equal(first.ok, true);
  assert.equal((await w.register.handle(FIELD, "p", person)).error.code, "CONFLICT");
  const near = await w.register.handle(FIELD, "p", { ...person, caseCode: "NG-0002" });
  assert.deepEqual(near.value.probableDuplicates, ["NG-0001"], "flagged, not refused");
  assert.equal((await w.list.handle(FIELD, "p")).value.counts.total, 2);
});

test("an export is saved only when every row is right; one bad row names its line and saves nobody", async () => {
  const w = beneficiaryWorld();
  const header = "case_code,sex,age_group,location,date,consent";
  const bad = [header, "NG-0100,female,under_5,A,2026-10-14,yes", "NG-0101,unknown,under_5,A,2026-10-14,yes"].join("\n");
  const refused = await w.importer.handle(FIELD, "p", bad);
  assert.equal(refused.ok, false);
  assert.match(refused.error.message, /Line 3/);
  assert.equal(w.rows.length, 0, "nobody was added");

  const good = [header, "NG-0100,female,under_5,A,2026-10-14,yes", "NG-0101,male,18_59,B,2026-10-14,yes"].join("\n");
  assert.deepEqual((await w.importer.handle(FIELD, "p", good)).value, { added: 2 });
  assert.equal(w.rows.length, 2);
  const clash = await w.importer.handle(FIELD, "p", good);
  assert.equal(clash.ok, false, "codes already in the project");
});

function automationWorld({ items, enabled = {}, today = "2026-10-20" } = {}) {
  const sent = [];
  const ledger = new Map();
  const ledgerApi = {
    wasSent: async (t, recipient, subjectKey, ruleKey, on) => ok(ledger.has(`${recipient}|${subjectKey}|${ruleKey}|${on ?? ""}`)),
    record: async (e) => (ledger.set(`${e.recipientId}|${e.subjectKey}|${e.ruleKey}|${e.sentOn}`, true), ok(undefined)),
  };
  const notifier = { send: async (m) => void sent.push(m) };
  const projects = { listByTenant: async () => ok([{ id: "p" }]) };
  const planItems = { findByProject: async () => ok(items) };
  const facts = { factsByPlannedActivity: async () => ok(new Map()) };
  const settings = { stored: async () => ok(enabled), enabledRules: async () => ok(new Set()) };
  const audience = { projectManagers: async () => ok(new Map([["p", "manager"]])) };
  const run = new RunAutomationsHandler(projects, planItems, facts, settings, audience, ledgerApi, notifier);
  return { sent, run };
}

test("the automation run tells the manager once about a soon-starting activity with no lead, and only when the rule is on", async () => {
  const item = PlannedActivity.create({ id: "a1", tenantId: "tenant-a", projectId: "p", title: "Training", plannedStart: "2026-10-21", plannedEnd: "2026-10-22", createdById: "pm" }).value;
  const off = automationWorld({ items: [item], enabled: { START_WITHOUT_LEAD: false } });
  assert.equal(await off.run.runFor(PM, "2026-10-20").then((r) => r.value), 0);

  const on = automationWorld({ items: [item] });
  assert.equal(await on.run.runFor(PM, "2026-10-20").then((r) => r.value), 1);
  assert.equal(on.sent[0].recipientId, "manager");
  assert.equal(await on.run.runFor(PM, "2026-10-20").then((r) => r.value), 0, "the ledger stops a repeat the same day");
});

test("a rule switched off is stored and audited by a manager only", async () => {
  const audit = [];
  const saved = [];
  const settings = { set: async (p, rule, enabled) => (saved.push([p, rule, enabled]), ok(undefined)), stored: async () => ok({}) };
  const handler = new SetAutomationRuleHandler(settings, { record: async (e) => void audit.push(e) }, { now: () => new Date() });
  assert.equal((await handler.handle(FIELD, "p", "START_WITHOUT_LEAD", false)).error.code, "FORBIDDEN");
  assert.equal((await handler.handle(PM, "p", "NOT_A_RULE", false)).ok, false);
  assert.equal((await handler.handle(PM, "p", "START_WITHOUT_LEAD", false)).ok, true);
  assert.deepEqual(saved, [["p", "START_WITHOUT_LEAD", false]]);
  assert.equal(audit.length, 1);
});
