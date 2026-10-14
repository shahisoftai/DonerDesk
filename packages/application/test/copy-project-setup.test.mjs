import assert from "node:assert/strict";
import test from "node:test";
import { CopyProjectSetupHandler } from "../dist/index.js";
import { Indicator, LogframeItem, TenantId } from "@donordesk/domain";

const ctx = { tenant: { tenantId: TenantId.create("tenant-a"), userId: "u", role: "ADMIN" }, requestId: "r" };
const ok = (value) => ({ ok: true, value });
const item = (id, level, parentId, projectId = "src") => LogframeItem.create({ id, tenantId: "tenant-a", projectId, level, parentId, code: id, title: `${id} title` });
const indicator = (id, logframeItemId) => Indicator.create({ id, tenantId: "tenant-a", projectId: "src", logframeItemId, code: `I-${id}`, name: `${id} name`, type: "NUMBER", baseline: "0", target: "5" });

function setup({ target = [], source = [item("g", "GOAL"), item("oc", "OUTCOME", "g"), item("op", "OUTPUT", "oc")], inds = [indicator("a", "op")], known = ["src", "dst"] } = {}) {
  const created = { items: [], indicators: [], audit: [] };
  let n = 0;
  const handler = new CopyProjectSetupHandler(
    { findById: async (id) => ok(known.includes(id) ? { id } : null) },
    { findByProject: async (id) => ok(id === "dst" ? target : source), create: async (i) => { created.items.push(i); return ok(i); } },
    { findByProject: async () => ok(inds), create: async (i) => { created.indicators.push(i); return ok(i); } },
    { generate: () => `n${++n}` },
    { record: async (e) => void created.audit.push(e) },
    () => new Date("2027-01-01"),
  );
  return { handler, created };
}

test("an empty project gets the tree and its indicators, parents first, and the copy is audited", async () => {
  const { handler, created } = setup();
  const out = await handler.handle(ctx, { targetProjectId: "dst", sourceProjectId: "src" });
  assert.deepEqual(out.value, { items: 3, indicators: 1 });
  assert.deepEqual(created.items.map((i) => i.level), ["GOAL", "OUTCOME", "OUTPUT"]);
  assert.ok(created.items.every((i) => i.projectId === "dst"));
  assert.equal(created.audit[0].eventType, "project.setup.copied");
});

test("it never copies into a project that already has a logframe, nor from itself or a missing project", async () => {
  const filled = setup({ target: [item("x", "GOAL", undefined, "dst")] });
  const a = await filled.handler.handle(ctx, { targetProjectId: "dst", sourceProjectId: "src" });
  assert.equal(a.ok, false);
  assert.equal(filled.created.items.length, 0);
  assert.equal((await setup().handler.handle(ctx, { targetProjectId: "dst", sourceProjectId: "dst" })).ok, false);
  const missing = await setup({ known: ["dst"] }).handler.handle(ctx, { targetProjectId: "dst", sourceProjectId: "src" });
  assert.equal(missing.ok, false);
  assert.equal(missing.error.code, "NOT_FOUND");
  assert.equal((await setup({ source: [] }).handler.handle(ctx, { targetProjectId: "dst", sourceProjectId: "src" })).ok, false);
});
