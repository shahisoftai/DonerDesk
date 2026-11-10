import test from "node:test";
import assert from "node:assert/strict";
import { TenantId } from "@donordesk/domain";
import { BuildDataWorkbookHandler } from "../dist/index.js";

const ctx = { tenant: { tenantId: TenantId.create("tenant-1"), userId: "u1", role: "VIEWER" }, requestId: "r" };
const table = (rows = 1) => ({ name: "T", columns: ["a"], rows: Array.from({ length: rows }, () => ["x"]) });

test("a workbook is refused when empty or too large, and an audit row records counts only", async () => {
  const events = [];
  const h = new BuildDataWorkbookHandler({ write: async () => Buffer.from("xlsx") }, { record: async (e) => { events.push(e); } });
  assert.equal((await h.handle(ctx, { title: "t", tables: [] })).ok, false);
  assert.equal((await h.handle(ctx, { title: "t", tables: Array.from({ length: 31 }, () => table()) })).ok, false);
  assert.equal((await h.handle(ctx, { title: "t", tables: [table(5001)] })).ok, false);
  const r = await h.handle(ctx, { title: "Results: Q1/Q2 <x>", tables: [table(3), table(2)] });
  assert.equal(r.ok, true);
  assert.equal(r.value.fileName, "Results Q1Q2 x-data.xlsx");
  assert.deepEqual(JSON.parse(events[0].newValue), { tables: 2, rows: 5 });
  assert.ok(!JSON.stringify(events).includes("Results"), "the title is not recorded");
});
