import test from "node:test";
import assert from "node:assert/strict";
import { GetDonorIndicatorMappingHandler, SetDonorIndicatorMappingHandler } from "../dist/index.js";

const ok = (value) => ({ ok: true, value });
const tenantId = { toString: () => "t1" };
const ctx = { tenant: { tenantId, userId: "u1" }, requestId: "r" };

function setup() {
  const stored = new Map();
  const audits = [];
  const template = {
    projectId: "p1",
    requirements: { indicatorRequirements: [{ id: "r1", text: "Report IND-1 monthly" }, { id: "r2", text: "Number of teachers trained" }, { id: "r3", text: "Number of latrines built" }] },
  };
  const templates = { findById: async (id) => ok(id === "t" ? template : null) };
  const indicators = { findByProject: async () => ok([{ id: "i1", code: "IND-1", name: "Wells drilled" }, { id: "i2", code: "IND-2", name: "Latrines built" }]) };
  const decisions = {
    listByTemplate: async () => ok([...stored.entries()].map(([requirementId, indicatorId]) => ({ requirementId, indicatorId }))),
    save: async (i) => (stored.set(i.requirementId, i.indicatorId), ok(undefined)),
    clear: async (_t, requirementId) => (stored.delete(requirementId), ok(undefined)),
  };
  const get = new GetDonorIndicatorMappingHandler(templates, indicators, decisions);
  const set = new SetDonorIndicatorMappingHandler(templates, indicators, decisions, { generate: () => "id" }, { record: async (e) => audits.push(e) });
  return { get, set, stored, audits };
}

test("each donor indicator is matched, suggested or left open, with the summary", async () => {
  const { get } = setup();
  const r = await get.handle(ctx, "t");
  assert.equal(r.ok, true);
  assert.deepEqual(r.value.rows.map((x) => x.status), ["MAPPED", "UNMAPPED", "SUGGESTED"]);
  assert.equal(r.value.rows[0].indicatorCode, "IND-1");
  assert.deepEqual(r.value.summary, { total: 3, mapped: 1, suggested: 1, unmapped: 1, notTracked: 0 });
});

test("confirming, declining and clearing change the answer and are audited", async () => {
  const { get, set, audits } = setup();
  assert.equal((await set.handle(ctx, "t", "r2", { action: "MAP", indicatorId: "i1" })).ok, true);
  assert.equal((await set.handle(ctx, "t", "r3", { action: "NOT_TRACKED" })).ok, true);
  let rows = (await get.handle(ctx, "t")).value.rows;
  assert.deepEqual(rows.map((x) => x.status), ["MAPPED", "MAPPED", "NOT_TRACKED"]);
  assert.equal(rows[1].indicatorCode, "IND-1");
  assert.equal((await set.handle(ctx, "t", "r3", { action: "CLEAR" })).ok, true);
  rows = (await get.handle(ctx, "t")).value.rows;
  assert.equal(rows[2].status, "SUGGESTED");
  assert.equal(audits.length, 3);
  assert.equal(audits[0].eventType, "template.indicator_mapping.set");
});

test("an indicator from another project, or a requirement the template does not have, is refused", async () => {
  const { set } = setup();
  assert.equal((await set.handle(ctx, "t", "r2", { action: "MAP", indicatorId: "elsewhere" })).ok, false);
  assert.equal((await set.handle(ctx, "t", "nope", { action: "NOT_TRACKED" })).ok, false);
  assert.equal((await set.handle(ctx, "missing", "r1", { action: "CLEAR" })).ok, false);
});
