// The launch steps that write plan leads, budget lines and the starting dashboard (Phase 38.9d). Fakes only.
import test from "node:test";
import assert from "node:assert/strict";
import { TenantId, DomainError, planKeyOf, budgetKeyOf, SUPPORT_LINE, SECTOR_TEMPLATES } from "@donordesk/domain";
import { BudgetLinesStep, DashboardStep, PlanLeadApplier, applyResponsibilities } from "../dist/index.js";
import { completeDraftForTest } from "./support/pcw-complete-draft.mjs";

const tenantId = TenantId.create("tenant-a");
const as = (userId, role = "ADMIN") => ({ tenant: { tenantId, userId, role }, requestId: "r" });
const ok = (value) => ({ ok: true, value });
const fail = (message) => ({ ok: false, error: DomainError.validation(message) });
const row = (id, title, plannedStart) => ({ id, title, plannedStart });

function budgetDraft() {
  const d = completeDraftForTest();
  const key = planKeyOf(d.proposal.plan[0].value);
  d.proposal.budget = [
    { value: { category: "Staff salaries", amount: "4000", currency: "EUR", logframeCode: null, kind: "LINE", ref: "F1" }, sourceQuote: null, sourceRef: null, confidence: "HIGH", status: "EDITED" },
    { value: { category: "Rig hire", amount: "2500.50", currency: "EUR", logframeCode: null, kind: "LINE" }, sourceQuote: null, sourceRef: null, confidence: "HIGH", status: "EDITED" },
    { value: { category: "Office", amount: "100", currency: "EUR", logframeCode: null, kind: "LINE" }, sourceQuote: null, sourceRef: null, confidence: "HIGH", status: "EDITED" },
  ];
  d.extras.finance.budgetPlan = { [budgetKeyOf(d.proposal.budget[0].value)]: key, [budgetKeyOf(d.proposal.budget[1].value)]: key, [budgetKeyOf(d.proposal.budget[2].value)]: SUPPORT_LINE };
  return d;
}

function planWorld(rows) {
  const lines = new Map();
  const added = [];
  return {
    added, lines,
    plan: { async rows() { return ok(rows); }, async assignLead() { return ok(undefined); } },
    budget: {
      async existingCodes(_c, id) { return ok(new Set(lines.get(id) ?? [])); },
      async add(_c, id, line) { added.push([id, line]); lines.set(id, [...(lines.get(id) ?? []), line.code]); return ok({ id: "l" }); },
    },
  };
}

test("budget lines: each is made on its own activity with a code, a kind from its words and its amount; whole-project lines are skipped", async () => {
  const w = planWorld([row("i1", "Drill wells", "2026-02-01")]);
  const out = await new BudgetLinesStep(w.plan, w.budget).run(as("u1"), "p1", budgetDraft());
  assert.deepEqual(out.value, { done: 2, notes: [] });
  assert.deepEqual(w.added.map(([id, l]) => [id, l.code, l.category, l.description, l.currency, l.amount]), [["i1", "F1", "PERSONNEL", "Staff salaries", "EUR", "4000"], ["i1", "B2", "OTHER", "Rig hire", "EUR", "2500.50"]]);
});

test("budget lines: a repeat adds nothing twice, and a code already on the activity is made unique", async () => {
  const w = planWorld([row("i1", "Drill wells", "2026-02-01")]);
  w.lines.set("i1", ["F1"]);
  const out = await new BudgetLinesStep(w.plan, w.budget).run(as("u1"), "p1", budgetDraft());
  assert.equal(out.value.done, 2);
  assert.deepEqual(w.added.map(([, l]) => l.code), ["F1-2", "B2"]);
});

test("budget lines: an activity that is missing or ambiguous, or a refusal, is a note and the rest carries on", async () => {
  const none = planWorld([]);
  const a = await new BudgetLinesStep(none.plan, none.budget).run(as("u1"), "p1", budgetDraft());
  assert.equal(a.value.done, 0);
  assert.match(a.value.notes[0], /Staff salaries: the activity “Drill wells” was not found/);
  const twice = planWorld([row("i1", "Drill wells", "2026-02-01"), row("i2", "Drill wells", "2026-02-01")]);
  assert.match((await new BudgetLinesStep(twice.plan, twice.budget).run(as("u1"), "p1", budgetDraft())).value.notes[0], /more than one activity is called “Drill wells”/);
  const refusing = planWorld([row("i1", "Drill wells", "2026-02-01")]);
  refusing.budget.add = async (_c, _i, line) => (line.code === "F1" ? fail("An activity can have up to 20 budget lines") : ok({}));
  const c = await new BudgetLinesStep(refusing.plan, refusing.budget).run(as("u1"), "p1", budgetDraft());
  assert.deepEqual([c.value.done, c.value.notes], [1, ["Staff salaries: An activity can have up to 20 budget lines"]]);
  const d = budgetDraft(); d.extras.finance.budgetPlan = {};
  assert.deepEqual((await new BudgetLinesStep(planWorld([]).plan, planWorld([]).budget).run(as("u1"), "p1", d)).value, { done: 0, notes: [] });
});

test("plan lead: the activity is found by title and start day and given its lead; missing or ambiguous is a sentence", async () => {
  const led = [];
  const mk = (rows) => new PlanLeadApplier({ async rows() { return ok(rows); }, async assignLead(_c, id, userId) { led.push([id, userId]); return ok(undefined); } });
  const r = { kind: "PLAN_LEAD", title: "Drill wells", start: "2026-02-01" };
  assert.equal((await mk([row("i1", "Drill wells", "2026-02-01"), row("i2", "Other", "2026-02-01")]).apply(as("u1"), "p1", "u-fay", r)).ok, true);
  assert.deepEqual(led, [["i1", "u-fay"]]);
  assert.equal((await mk([row("i1", "Drill wells", "2026-03-01")]).apply(as("u1"), "p1", "u-fay", r)).ok, false);
  const open = await mk([row("i1", "Drill wells", "2026-02-01"), row("i2", "Drill wells", "2026-02-01")]).apply(as("u1"), "p1", "u-fay", r);
  assert.match(open.error.message, /More than one planned activity is called “Drill wells”/);
  assert.equal((await mk([row("i1", "Drill wells", "2026-02-01"), row("i2", "Drill wells", "2026-05-01")]).apply(as("u1"), "p1", "u-fay", { ...r, start: null })).ok, false, "with no start day given, two of the same name are ambiguous");
  const viaTable = await applyResponsibilities([mk([row("i1", "Drill wells", "2026-02-01")])], as("u1"), "p1", "u-fay", [r]);
  assert.equal(viaTable.done, 1);
});

// ---------- the starting dashboard ----------

function dashWorld(indicators, apply) {
  const calls = [];
  return { calls, writer: { async indicators() { return ok(indicators); }, async apply(_c, templateId, input) { calls.push([templateId, input]); return apply(templateId, input); } } };
}
const wash = SECTOR_TEMPLATES.find((t) => t.id === "tpl-wash-access-hygiene");

test("dashboard: the chosen template is made for the project with indicators suggested by their words, never forced", async () => {
  const d = completeDraftForTest();
  const w = dashWorld([{ id: "ind-1", code: "I1", name: "People with access to safe drinking water", type: "NUMBER", isRate: false }], async () => ok({ dashboardId: "dash-1", chartsLeftOut: [{ title: "Latrine coverage", missingRoles: ["latrines"] }] }));
  const out = await new DashboardStep(w.writer).run(as("u1"), "p1", d);
  assert.equal(out.value.done, 1);
  assert.deepEqual(out.value.notes, ["“Latrine coverage” was left out: no indicator clearly answers latrines. Choose one on the dashboard."]);
  const [templateId, input] = w.calls[0];
  assert.equal(templateId, "tpl-wash-access-hygiene");
  assert.deepEqual([input.projectId, input.name], ["p1", wash.title]);
  assert.deepEqual(Object.keys(input.mapping).sort(), wash.roles.map((r) => r.key).sort(), "every role is listed; those with no clear match are null");
  assert.ok(Object.values(input.mapping).filter((v) => v !== null).every((v) => v === "ind-1"));
});

test("dashboard: nothing chosen makes nothing; a dashboard that cannot be drawn is a note, not a failure; a missing template is said", async () => {
  const w = dashWorld([], async () => ({ ok: false, error: DomainError.validation("None of this template's charts can be drawn until you choose which indicators it should use.") }));
  const d = completeDraftForTest();
  const refused = await new DashboardStep(w.writer).run(as("u1"), "p1", d);
  assert.equal(refused.ok, true);
  assert.deepEqual(refused.value.done, 0);
  assert.match(refused.value.notes[0], /The starting dashboard was not made: None of this template's charts can be drawn/);
  delete d.extras.dashboardTemplate;
  assert.deepEqual((await new DashboardStep(w.writer).run(as("u1"), "p1", d)).value, { done: 0, notes: [] });
  d.extras.dashboardTemplate = "tpl-gone";
  assert.match((await new DashboardStep(w.writer).run(as("u1"), "p1", d)).value.notes[0], /no longer offered/);
  const broken = { async indicators() { return fail("no"); }, async apply() { return ok({}); } };
  d.extras.dashboardTemplate = "tpl-wash-access-hygiene";
  assert.equal((await new DashboardStep(broken).run(as("u1"), "p1", d)).ok, false, "a failure to read the project's indicators stops the step");
});
