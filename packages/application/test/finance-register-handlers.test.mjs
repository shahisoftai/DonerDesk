import test from "node:test";
import assert from "node:assert/strict";
import { TenantId } from "@donordesk/domain";
import {
  AccountForAdvanceHandler, AddAdvanceHandler, AddCurrencyRateHandler, AddDeliverableHandler, AddDisbursementHandler, AddProjectFundingHandler, AddRegisterExpenseHandler, ChangeDeliverableHandler,
  CreateFundingSourceHandler, DecideEntryHandler, GetProjectFinanceHandler, ImportRegisterSheetHandler, UpdateFundingSourceHandler, SetSeparateApproverHandler, UpdateDraftEntryHandler,
} from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ctxFor = (role, userId = "u1") => ({ tenant: { tenantId, userId, role }, requestId: "r" });
const admin = ctxFor("ADMIN"), pm = ctxFor("PROJECT_MANAGER", "u2"), me = ctxFor("ME_OFFICER", "u3"), field = ctxFor("FIELD_OFFICER", "u4"), viewer = ctxFor("VIEWER", "u5");
const ok = (value) => ({ ok: true, value });
let n = 0;
const ids = { generate: () => `id${++n}` };
const clock = { now: () => new Date("2026-03-01T10:00:00Z") };
const auditLog = [];
const audit = { record: async (e) => { auditLog.push(e.eventType); } };
const d = { audit, clock, ids };

const memory = (key = "id") => {
  const rows = [];
  return { rows, async list() { return ok([...rows]); }, async findById(id) { return ok(rows.find((r) => r[key] === id) ?? null); }, async create(r) { rows.push({ ...r }); return ok(undefined); },
    async update(id, _t, patch) { Object.assign(rows.find((r) => r.id === id), patch); return ok(undefined); }, async delete(id) { const i = rows.findIndex((r) => r.id === id); if (i >= 0) rows.splice(i, 1); return ok(undefined); } };
};
const project = { archivedAt: undefined, budget: { amount: 1000, currency: "USD" }, duration: { start: new Date("2026-01-01T00:00:00Z"), end: new Date("2026-12-31T00:00:00Z") } };
const projects = { findById: async (id) => ok(id === "p1" ? project : null) };
const lineRows = [{ id: "L1", projectId: "p1", code: "1.1", category: "TRAVEL", description: "", currency: "USD", amountMinor: 100000 }];
const lines = { findLineById: async (id) => ok(lineRows.find((l) => l.id === id) ?? null), findLinesByProject: async () => ok(lineRows) };

function world() {
  const sources = memory(), fundings = { ...memory(), async listByProject(p) { return ok(this.rows.filter((r) => r.projectId === p)); } };
  const mk = () => ({ ...memory(), async listByProject(p) { return ok(this.rows.filter((r) => r.projectId === p)); },
    async updateDraft(id, _t, x) { const r = this.rows.find((y) => y.id === id); if (!r || r.status !== "DRAFT") return ok(false); Object.assign(r, x, x.memo !== undefined ? { memo: x.memo } : {}); return ok(true); },
    async decide(id, _t, x) { const r = this.rows.find((y) => y.id === id); if (!r || r.status !== "DRAFT") return ok(false); Object.assign(r, { status: x.status, decidedById: x.byId, decisionNote: x.note }); return ok(true); } });
  const disb = mk(), exps = mk();
  const dels = { ...memory(), async listByProject(p) { return ok(this.rows.filter((r) => r.projectId === p)); },
    async approve(id, _t, by, at) { const r = this.rows.find((y) => y.id === id); if (r.approvedAt) return ok(false); Object.assign(r, { approvedById: by, approvedAt: at }); return ok(true); },
    async markPaid(id, _t, on) { const r = this.rows.find((y) => y.id === id); if (!r.approvedAt || r.paidOn) return ok(false); r.paidOn = on; return ok(true); } };
  const advs = { ...memory(), async listByProject(p) { return ok(this.rows.filter((r) => r.projectId === p).map((a) => ({ ...a, accounted: this.acc.filter((x) => x.advanceId === a.id) }))); },
    async findById(id) { const a = this.rows.find((r) => r.id === id); return ok(a ? { ...a, accounted: this.acc.filter((x) => x.advanceId === id) } : null); }, acc: [], async addAccounting(_t, a) { this.acc.push(a); return ok(undefined); } };
  const rates = { rows: [], async list() { return ok([...this.rows]); }, async add(r) { this.rows.push(r); return ok(undefined); } };
  const settings = { separate: false, async get() { return ok({ primaryCurrency: "USD", separateApprover: this.separate }); }, set: async () => ok(undefined), async setSeparateApprover(_t, on) { this.separate = on; return ok(undefined); } };
  return { sources, fundings, disb, exps, dels, advs, rates, settings };
}

test("only an administrator adds funding sources; a duplicate name is refused; the flag can change", async () => {
  const w = world();
  const add = new CreateFundingSourceHandler(w.sources, d);
  assert.equal((await add.handle(pm, { name: "Donor A" })).ok, false);
  const a = await add.handle(admin, { name: "Donor A" });
  assert.equal(a.ok, true);
  assert.equal((await add.handle(admin, { name: "donor a" })).error.code, "CONFLICT");
  assert.equal((await new UpdateFundingSourceHandler(w.sources, d).handle(admin, a.value.id, { ownFunding: false })).ok, true);
  assert.equal(w.sources.rows[0].ownFunding, false);
});

test("funding needs project.edit, a live project and a listed source; amounts become minor units", async () => {
  const w = world();
  const s = (await new CreateFundingSourceHandler(w.sources, d).handle(admin, { name: "Donor A" })).value.id;
  const h = new AddProjectFundingHandler(projects, w.sources, w.fundings, d);
  const input = { fundingSourceId: s, date: "2026-01-05", amount: "50,000", currency: "usd" };
  assert.equal((await h.handle(field, "p1", input)).ok, false);
  assert.equal((await h.handle(admin, "nope", input)).error.code, "NOT_FOUND");
  assert.equal((await h.handle(admin, "p1", { ...input, fundingSourceId: "zzz" })).ok, false);
  assert.equal((await h.handle(admin, "p1", input)).ok, true);
  assert.deepEqual(w.fundings.rows[0].amount, { minor: 5000000, currency: "USD" });
});

test("an expense is a draft until someone with finance.approve decides it, once; a rejection needs a reason; the budget line must belong to the project", async () => {
  const w = world();
  const add = new AddRegisterExpenseHandler(projects, lines, w.sources, w.exps, d);
  assert.equal((await add.handle(viewer, "p1", "L1", { date: "2026-02-01", amount: "10", vendor: "Acme" })).ok, false);
  assert.equal((await add.handle(me, "p1", "ZZ", { date: "2026-02-01", amount: "10", vendor: "Acme" })).error.code, "NOT_FOUND");
  const e = await add.handle(field, "p1", "L1", { date: "2026-02-01", amount: "10", vendor: "Acme" });
  assert.equal(e.ok, true);
  assert.equal(w.exps.rows[0].status, "DRAFT");
  const decide = new DecideEntryHandler(w.exps, w.disb, w.settings, d);
  assert.equal((await decide.handle(me, "p1", "EXPENSE", e.value.id, { decision: "APPROVED" })).ok, false);
  assert.match((await decide.handle(pm, "p1", "EXPENSE", e.value.id, { decision: "REJECTED" })).error.message, /why/);
  assert.equal((await decide.handle(pm, "p1", "EXPENSE", e.value.id, { decision: "APPROVED" })).ok, true);
  assert.equal(w.exps.rows[0].status, "APPROVED");
  assert.equal((await decide.handle(admin, "p1", "EXPENSE", e.value.id, { decision: "REJECTED", note: "x" })).error.code, "CONFLICT");
});

test("a disbursement follows the same draft-then-decide path", async () => {
  const w = world();
  const s = (await new CreateFundingSourceHandler(w.sources, d).handle(admin, { name: "Donor A" })).value.id;
  const r = await new AddDisbursementHandler(projects, w.sources, w.disb, d).handle(pm, "p1", { fundingSourceId: s, date: "2026-02-01", amount: "1000", currency: "USD" });
  assert.equal(w.disb.rows[0].status, "DRAFT");
  assert.equal((await new DecideEntryHandler(w.exps, w.disb, w.settings, d).handle(admin, "p1", "DISBURSEMENT", r.value.id, { decision: "APPROVED" })).ok, true);
});

test("currency rates are added by an administrator, validated, and never edited", async () => {
  const w = world();
  const h = new AddCurrencyRateHandler(w.rates, d);
  assert.equal((await h.handle(pm, { from: "EUR", to: "USD", rate: "1.1", effectiveOn: "2026-01-01" })).ok, false);
  assert.match((await h.handle(admin, { from: "EUR", to: "EUR", rate: "1.1", effectiveOn: "2026-01-01" })).error.message, /different/);
  assert.equal((await h.handle(admin, { from: "eur", to: "usd", rate: "1.1", effectiveOn: "2026-01-01", source: "Treasury" })).ok, true);
  assert.equal(w.rates.rows[0].from, "EUR");
});

test("a deliverable is approved by someone who may, then paid; payment before approval is refused", async () => {
  const w = world();
  const dl = await new AddDeliverableHandler(projects, w.dels, d).handle(pm, "p1", { name: "Baseline", amount: "500", currency: "USD", dueOn: "2026-02-01" });
  const change = new ChangeDeliverableHandler(w.dels, w.settings, d);
  assert.match((await change.handle(pm, "p1", dl.value.id, { action: "PAY", on: "2026-02-10" })).error.message, /approved before/);
  assert.equal((await change.handle(me, "p1", dl.value.id, { action: "APPROVE" })).ok, false);
  assert.equal((await change.handle(pm, "p1", dl.value.id, { action: "APPROVE" })).ok, true);
  assert.equal((await change.handle(pm, "p1", dl.value.id, { action: "APPROVE" })).ok, false);
  assert.equal((await change.handle(pm, "p1", dl.value.id, { action: "PAY", on: "2026-03-01" })).ok, true);
  assert.equal((await change.handle(pm, "other-project", dl.value.id, { action: "PAY", on: "2026-03-01" })).error.code, "NOT_FOUND");
});

test("an advance is accounted for in its own currency, and not before it was given", async () => {
  const w = world();
  const a = await new AddAdvanceHandler(projects, w.advs, d).handle(pm, "p1", { heldBy: "Field team", givenOn: "2026-01-10", amount: "1000", currency: "USD" });
  const acc = new AccountForAdvanceHandler(w.advs, d);
  assert.equal((await acc.handle(pm, "p1", a.value.id, { date: "2026-01-20", amount: "400", currency: "USD" })).ok, true);
  assert.match((await acc.handle(pm, "p1", a.value.id, { date: "2026-01-20", amount: "400", currency: "EUR" })).error.message, /in USD/);
  assert.match((await acc.handle(pm, "p1", a.value.id, { date: "2026-01-01", amount: "400", currency: "USD" })).error.message, /before/);
  assert.equal((await acc.handle(field, "p1", a.value.id, { date: "2026-01-20", amount: "1", currency: "USD" })).ok, false);
});

test("the project finance read counts own funding only, converts only with a dated rate, and keeps drafts out of spent", async () => {
  const w = world();
  const own = (await new CreateFundingSourceHandler(w.sources, d).handle(admin, { name: "Donor A" })).value.id;
  const other = (await new CreateFundingSourceHandler(w.sources, d).handle(admin, { name: "Govt", ownFunding: false })).value.id;
  const fund = new AddProjectFundingHandler(projects, w.sources, w.fundings, d);
  await fund.handle(admin, "p1", { fundingSourceId: own, date: "2026-01-05", amount: "1000", currency: "USD" });
  await fund.handle(admin, "p1", { fundingSourceId: own, date: "2026-01-06", amount: "100", currency: "EUR" });
  await fund.handle(admin, "p1", { fundingSourceId: other, date: "2026-01-06", amount: "999", currency: "USD" });
  const e1 = await new AddRegisterExpenseHandler(projects, lines, w.sources, w.exps, d).handle(field, "p1", "L1", { date: "2026-02-01", amount: "10", vendor: "A" });
  await new AddRegisterExpenseHandler(projects, lines, w.sources, w.exps, d).handle(field, "p1", "L1", { date: "2026-02-02", amount: "20", vendor: "B" });
  await new DecideEntryHandler(w.exps, w.disb, w.settings, d).handle(pm, "p1", "EXPENSE", e1.value.id, { decision: "APPROVED" });
  const read = new GetProjectFinanceHandler(projects, lines, w.sources, w.fundings, w.disb, w.exps, w.advs, w.dels, w.rates, w.settings, clock);
  assert.equal((await read.handle(ctxFor("VIEWER"), "p1")).ok, true);
  let f = (await read.handle(viewer, "p1")).value;
  assert.deepEqual(f.index.obligated, [{ minor: 100000, currency: "USD" }, { minor: 10000, currency: "EUR" }]);
  assert.deepEqual(f.index.otherFunding, [{ minor: 99900, currency: "USD" }]);
  assert.deepEqual(f.index.spent, [{ minor: 1000, currency: "USD" }]);
  assert.equal(f.inPrimary.obligated.total, null);
  assert.equal(f.inPrimary.obligated.needsRate.length, 1);
  assert.equal(f.budgetLines[0].spentMinor, 1000);
  assert.equal(f.register.filter((r) => r.status === "DRAFT").length, 1);
  assert.equal(f.register.find((r) => r.status === "DRAFT").canDecide, false);
  assert.equal(f.burn.spentPercent, 1);
  await new AddCurrencyRateHandler(w.rates, d).handle(admin, { from: "EUR", to: "USD", rate: "1.10", effectiveOn: "2026-01-01" });
  f = (await read.handle(pm, "p1")).value;
  assert.deepEqual(f.inPrimary.obligated.total, { minor: 111000, currency: "USD" });
  assert.equal(f.register.find((r) => r.status === "DRAFT").canDecide, true);
  assert.ok(auditLog.includes("finance.entry_approved"));
});

const SHEET = "Type,Date,Amount,Currency,Paid to,What for,Budget line,Funding source\nExpense,2026-02-01,10,,Acme,Fuel,1.1,\nMoney received,2026-02-02,500,USD,,Tranche,,Donor A\n";

test("a sheet is checked first, stored as drafts only when applied, stored once if applied twice, and blocked entirely by one bad row", async () => {
  const w = world();
  await new CreateFundingSourceHandler(w.sources, d).handle(admin, { name: "Donor A" });
  const imp = new ImportRegisterSheetHandler(projects, lines, w.sources, w.exps, w.disb, w.settings, d);
  const check = (await imp.handle(pm, "p1", { text: SHEET, apply: false })).value;
  assert.deepEqual([check.rows, check.valid, check.invalid, check.imported, check.applied], [2, 2, 0, 0, false]);
  assert.equal(w.exps.rows.length, 0);
  const done = (await imp.handle(pm, "p1", { text: SHEET, apply: true })).value;
  assert.deepEqual([done.imported, done.alreadyThere, done.applied], [2, 0, true]);
  assert.equal(w.exps.rows[0].status, "DRAFT");
  assert.equal(w.disb.rows[0].status, "DRAFT");
  const again = (await imp.handle(pm, "p1", { text: SHEET, apply: true })).value;
  assert.deepEqual([again.imported, again.alreadyThere], [0, 2]);
  assert.equal(w.exps.rows.length, 1);
  const bad = (await imp.handle(pm, "p1", { text: SHEET + "Gift,2026-02-03,5,,,,,\n", apply: true })).value;
  assert.equal(bad.applied, false);
  assert.equal(bad.invalid, 1);
  assert.equal(bad.problems[0].row, 4);
  assert.match(bad.errorFile, /Problems/);
  assert.equal(w.exps.rows.length, 1);
});

test("importing needs permission, and money received needs project.edit", async () => {
  const w = world();
  await new CreateFundingSourceHandler(w.sources, d).handle(admin, { name: "Donor A" });
  const imp = new ImportRegisterSheetHandler(projects, lines, w.sources, w.exps, w.disb, w.settings, d);
  assert.equal((await imp.handle(viewer, "p1", { text: SHEET, apply: true })).ok, false);
  const field_ = (await imp.handle(field, "p1", { text: SHEET, apply: true })).value;
  assert.equal(field_.applied, false);
  assert.match(field_.problems[0].message, /cannot record money received/);
  assert.equal((await imp.handle(admin, "nope", { text: SHEET, apply: false })).error.code, "NOT_FOUND");
});

test("a draft expense can be changed by its author or an approver, a decided one never; the file can be attached", async () => {
  const w = world();
  const add = new AddRegisterExpenseHandler(projects, lines, w.sources, w.exps, d);
  const e = await add.handle(field, "p1", "L1", { date: "2026-02-01", amount: "10", vendor: "Acme" });
  const edit = new UpdateDraftEntryHandler(lines, w.sources, w.exps, w.disb, d);
  assert.equal((await edit.handle(viewer, "p1", "EXPENSE", e.value.id, { date: "2026-02-02", amount: "12", vendor: "Acme" })).ok, false);
  assert.equal((await edit.handle(field, "p1", "EXPENSE", e.value.id, { date: "2026-02-02", amount: "12", vendor: "Acme Ltd", evidenceId: "ev1" })).ok, true);
  assert.deepEqual(w.exps.rows[0].amount, { minor: 1200, currency: "USD" });
  assert.equal(w.exps.rows[0].evidenceId, "ev1");
  assert.equal((await edit.handle(field, "p2", "EXPENSE", e.value.id, { date: "2026-02-02", amount: "12", vendor: "x" })).error.code, "NOT_FOUND");
  assert.equal((await edit.handle(field, "p1", "EXPENSE", e.value.id, { date: "2026-02-02", amount: "-5", vendor: "x" })).ok, false);
  await new DecideEntryHandler(w.exps, w.disb, w.settings, d).handle(pm, "p1", "EXPENSE", e.value.id, { decision: "APPROVED" });
  assert.match((await edit.handle(pm, "p1", "EXPENSE", e.value.id, { date: "2026-02-02", amount: "13", vendor: "x" })).error.message, /already been decided/);
});

test("when the organisation asks for a second person, the one who entered an entry cannot decide it; only an administrator sets this", async () => {
  const w = world();
  const e = await new AddRegisterExpenseHandler(projects, lines, w.sources, w.exps, d).handle(pm, "p1", "L1", { date: "2026-02-01", amount: "10", vendor: "Acme" });
  assert.equal((await new SetSeparateApproverHandler(w.settings, d).handle(pm, { on: true })).ok, false);
  assert.equal((await new SetSeparateApproverHandler(w.settings, d).handle(admin, { on: true })).ok, true);
  const decide = new DecideEntryHandler(w.exps, w.disb, w.settings, d);
  assert.match((await decide.handle(pm, "p1", "EXPENSE", e.value.id, { decision: "APPROVED" })).error.message, /Someone else/);
  assert.equal((await decide.handle(admin, "p1", "EXPENSE", e.value.id, { decision: "APPROVED" })).ok, true);
});
