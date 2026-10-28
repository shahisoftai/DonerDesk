import test from "node:test";
import assert from "node:assert/strict";
import { TenantId } from "@donordesk/domain";
import { ListSavedReportsHandler, SaveSavedReportHandler, DeleteSavedReportHandler } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ok = (value) => ({ ok: true, value });
const as = (userId, role = "PROJECT_MANAGER") => ({ tenant: { tenantId, userId, role }, requestId: "r" });
const amina = as("amina"), bashir = as("bashir"), vera = as("vera", "VIEWER");
let n = 0;
const ids = { generate: () => `r${++n}` };
const audit = { events: [], record: async function (e) { this.events.push(e.eventType); } };
const clock = { now: () => new Date("2026-10-10T08:00:00Z") };
const query = (over = {}) => ({ indicatorIds: ["i1", "i2"], measure: "PERIOD", rows: "INDICATOR", includeDraft: true, ...over });
const input = (over = {}) => ({ name: "Quarterly", scope: "MINE", projectId: "p1", query: query(), ...over });

function world(visible = ["p1"]) {
  const rows = new Map();
  const repo = {
    create: async (r) => (rows.set(r.id, r), ok()),
    update: async (r) => (rows.set(r.id, r), ok(true)),
    delete: async (id) => (rows.delete(id), ok()),
    findById: async (id) => ok(rows.get(id) ?? null),
    listForProject: async (_t, projectId, ownerId) => ok([...rows.values()].filter((r) => r.projectId === projectId && (r.scope === "PROJECT" || r.ownerId === ownerId))),
  };
  const vis = { for: async () => ok(visible.map((id) => ({ id }))) };
  return { rows, save: new SaveSavedReportHandler(ids, repo, vis, audit, clock), list: new ListSavedReportsHandler(repo, vis), del: new DeleteSavedReportHandler(repo, vis, audit) };
}

test("a report keeps its question, not figures; a personal one is its owner's, a project one is shared", async () => {
  const w = world();
  const mine = await w.save.handle(amina, input());
  assert.equal(mine.ok, true);
  assert.deepEqual(Object.keys(w.rows.get(mine.value.id).query).sort(), ["includeDraft", "indicatorIds", "measure", "rows"]);
  assert.equal((await w.list.handle(bashir, "p1")).value.reports.length, 0);
  const shared = await w.save.handle(amina, input({ scope: "PROJECT", name: "Shared" }));
  assert.equal((await w.list.handle(bashir, "p1")).value.reports.length, 1);
  assert.equal((await w.list.handle(vera, "p1")).value.reports[0].canEdit, false);
  assert.equal((await w.save.handle(vera, input({ scope: "PROJECT" }))).ok, false, "a viewer cannot share");
  assert.equal((await w.del.handle(vera, shared.value.id)).ok, false);
  assert.equal((await w.del.handle(amina, shared.value.id)).ok, true);
});

test("an empty question, a bad name or another project is refused", async () => {
  const w = world(["p1"]);
  assert.equal((await w.save.handle(amina, input({ query: query({ indicatorIds: [] }) }))).ok, false);
  assert.equal((await w.save.handle(amina, input({ query: query({ indicatorIds: ["a", "a"] }) }))).ok, false);
  assert.equal((await w.save.handle(amina, input({ name: " " }))).ok, false);
  assert.equal((await w.save.handle(amina, input({ projectId: "p2" }))).ok, false);
});
