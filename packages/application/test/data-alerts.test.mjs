import test from "node:test";
import assert from "node:assert/strict";
import { TenantId } from "@donordesk/domain";
import { AddAlertHandler, RunDataAlertsHandler, MAX_ALERTS_PER_PERSON } from "../dist/index.js";

const tenantId = TenantId.create("tenant-1");
const ok = (value) => ({ ok: true, value });
const sheet = { projectId: "p", periods: [{ id: "p1", label: "Jan", start: "2026-01-01", end: "2026-01-31", reportType: "MONTHLY", locked: false }],
  indicators: [{ id: "i1", code: "A", name: "Enrolled", level: null, type: "NUMBER", baseline: "0", target: "100", isRate: false }],
  cells: [{ indicatorId: "i1", periodId: "p1", periodValue: "20", cumulativeValue: "", status: "VERIFIED" }], finance: [] };
const fakeRepo = (rows = []) => ({ rows,
  create: async (a) => { rows.push(a); return ok(undefined); }, delete: async () => ok(undefined),
  listForUser: async (_t, u) => ok(rows.filter((r) => r.userId === u)), listAll: async () => ok(rows),
  setState: async (id, _t, s) => { rows.find((r) => r.id === id).lastState = s; return ok(undefined); } });
const sheets = (s = ok(sheet)) => ({ handle: async () => s });
const ctx = { tenant: { tenantId, userId: "u1", role: "PROJECT_MANAGER" }, requestId: "r" };
const audit = { record: async () => {} };

test("an alert needs a valid rule, an indicator in the project, and stays within the limit", async () => {
  const repo = fakeRepo();
  const add = new AddAlertHandler({ generate: () => "a" + repo.rows.length }, repo, sheets(), audit, { now: () => new Date("2026-02-01") });
  assert.equal((await add.handle(ctx, { projectId: "p", indicatorId: "i1", kind: "BELOW" })).ok, false);
  assert.equal((await add.handle(ctx, { projectId: "p", indicatorId: "nope", kind: "BELOW", value: 5 })).ok, false);
  assert.equal((await add.handle(ctx, { projectId: "p", indicatorId: "i1", kind: "BELOW", value: 50 })).ok, true);
  for (let i = 0; i < MAX_ALERTS_PER_PERSON; i += 1) await add.handle(ctx, { projectId: "p", indicatorId: "i1", kind: "ABOVE", value: i });
  assert.equal((await add.handle(ctx, { projectId: "p", indicatorId: "i1", kind: "ABOVE", value: 99 })).ok, false);
});

test("a project the person cannot read is not found and nothing is stored", async () => {
  const repo = fakeRepo();
  const add = new AddAlertHandler({ generate: () => "x" }, repo, sheets({ ok: false, error: new Error("not found") }), audit, { now: () => new Date() });
  assert.equal((await add.handle(ctx, { projectId: "p", indicatorId: "i1", kind: "BELOW", value: 5 })).ok, false);
  assert.equal(repo.rows.length, 0);
});

test("the run tells the owner once when a figure crosses, and again only after it recovers", async () => {
  const repo = fakeRepo([{ id: "a1", tenantId, userId: "u1", role: "PROJECT_MANAGER", projectId: "p", indicatorId: "i1", ruleKind: "BELOW", ruleValue: 50, lastState: "OK", createdAt: new Date() }]);
  const sent = [];
  const run = new RunDataAlertsHandler(repo, sheets(), { send: async (n) => { sent.push(n); } }, { now: () => new Date("2026-02-01T08:00:00Z") });
  assert.equal((await run.handle(tenantId)).value.told, 1);
  assert.equal((await run.handle(tenantId)).value.told, 0);
  assert.equal(sent.length, 1); assert.equal(sent[0].recipientId, "u1"); assert.match(sent[0].message, /below your limit of 50/);
  assert.equal(repo.rows[0].lastState, "FIRING");
});

test("an alert whose project can no longer be read is skipped, not fired", async () => {
  const repo = fakeRepo([{ id: "a1", tenantId, userId: "u1", role: "VIEWER", projectId: "p", indicatorId: "i1", ruleKind: "BELOW", ruleValue: 50, lastState: "OK", createdAt: new Date() }]);
  const sent = [];
  const run = new RunDataAlertsHandler(repo, sheets({ ok: false, error: new Error("gone") }), { send: async (n) => { sent.push(n); } }, { now: () => new Date() });
  const r = await run.handle(tenantId);
  assert.equal(r.value.skipped, 1); assert.equal(sent.length, 0);
});
