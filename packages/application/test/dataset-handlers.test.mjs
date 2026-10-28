import test from "node:test";
import assert from "node:assert/strict";
import { TenantId } from "@donordesk/domain";
import { ResolveDatasetsHandler } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const as = (userId, role = "PROJECT_MANAGER") => ({ tenant: { tenantId, userId, role }, requestId: "r" });
const periods = [{ id: "p1", label: "Jan", start: "2026-01-01", end: "2026-01-31", reportType: "MONTHLY", locked: false }];
const sheetOf = (projectId) => ({
  projectId, periods,
  indicators: [{ id: "i1", code: "A", name: "A", level: "OUTPUT", type: "COUNT", unit: "people", baseline: "0", target: "100", isRate: false }],
  cells: [{ indicatorId: "i1", periodId: "p1", periodValue: "10", cumulativeValue: "10", status: "DRAFT" }], finance: [], financeEnabled: false,
});
const query = (over = {}) => ({ indicatorIds: ["i1"], measure: "PERIOD", includeDraft: true, ...over });

function build({ visible = ["p1", "p2"], failFor = [] } = {}) {
  const reads = [];
  const sheets = { handle: async (_ctx, projectId) => { reads.push(projectId); return failFor.includes(projectId) ? { ok: false, error: new Error("boom") } : { ok: true, value: sheetOf(projectId) }; } };
  const visibleProjects = { for: async () => ({ ok: true, value: visible.map((id) => ({ id })) }) };
  return { handler: new ResolveDatasetsHandler(sheets, visibleProjects), reads };
}

test("one sheet read per project however many requests name it, answered in the order asked", async () => {
  const { handler, reads } = build();
  const r = await handler.handle(as("amina"), [
    { key: "a", projectId: "p1", query: query() }, { key: "b", projectId: "p2", query: query() }, { key: "c", projectId: "p1", query: query({ measure: "CUMULATIVE" }) },
  ]);
  assert.equal(r.ok, true);
  assert.deepEqual(reads, ["p1", "p2"]);
  assert.deepEqual(r.value.datasets.map((d) => d.key), ["a", "b", "c"]);
  assert.equal(r.value.datasets[0].dataset.points[0].value, 10);
  assert.equal(r.value.datasets[2].dataset.points[0].value, 10);
});

test("a project the person cannot see is answered 'cannot see' and its sheet is never read", async () => {
  const { handler, reads } = build({ visible: ["p1"] });
  const r = await handler.handle(as("amina"), [{ key: "x", projectId: "p2", query: query() }, { key: "y", projectId: "p1", query: query() }]);
  assert.deepEqual(reads, ["p1"]);
  assert.match(r.value.datasets[0].unavailable, /cannot see/);
  assert.ok(r.value.datasets[1].dataset);
});

test("a sheet that cannot be read is reported for its requests only", async () => {
  const { handler } = build({ failFor: ["p2"] });
  const r = await handler.handle(as("amina"), [{ key: "a", projectId: "p1", query: query() }, { key: "b", projectId: "p2", query: query() }]);
  assert.ok(r.value.datasets[0].dataset);
  assert.match(r.value.datasets[1].unavailable, /could not be read/);
});

test("drafts are withheld unless the request asks for them", async () => {
  const { handler } = build();
  const r = await handler.handle(as("amina"), [{ key: "a", projectId: "p1", query: query({ includeDraft: false }) }]);
  assert.equal(r.value.datasets[0].dataset.points[0].value, null);
  assert.equal(r.value.datasets[0].dataset.withheldDrafts, 1);
});

test("duplicate keys and too many requests are refused; none is fine", async () => {
  const { handler, reads } = build();
  const dup = await handler.handle(as("amina"), [{ key: "a", projectId: "p1", query: query() }, { key: "a", projectId: "p1", query: query() }]);
  assert.equal(dup.ok, false);
  const many = await handler.handle(as("amina"), Array.from({ length: 25 }, (_, i) => ({ key: `k${i}`, projectId: "p1", query: query() })));
  assert.equal(many.ok, false);
  assert.deepEqual((await handler.handle(as("amina"), [])).value, { datasets: [] });
  assert.deepEqual(reads, []);
});
