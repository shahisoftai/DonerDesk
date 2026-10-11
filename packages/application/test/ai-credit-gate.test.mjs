import assert from "node:assert/strict";
import test from "node:test";
import { AiCreditGate } from "../dist/index.js";

const ok = (value) => ({ ok: true, value });
const tenantId = { toString: () => "tenant-a" };

function build({ limit, used, packs = [], mode = "enforce", audits = [] }) {
  const entitlements = { resolve: async () => ok({ limits: { monthlyAiDraftCredits: limit } }) };
  const runs = { countAiReportDrafts: async () => ok(used) };
  const audit = { record: async (e) => { audits.push(e); } };
  const packRepo = { listActiveByTenant: async () => ok(packs) };
  return new AiCreditGate(entitlements, runs, audit, packRepo, () => mode);
}

test("unlimited plan is always allowed", async () => {
  assert.ok((await build({ limit: null, used: 999 }).assertAvailable(tenantId, "u")).ok);
});

test("credits left on the plan are allowed", async () => {
  assert.ok((await build({ limit: 5, used: 4 }).assertAvailable(tenantId, "u")).ok);
});

test("plan exhausted and no pack: AI_CREDITS_EXHAUSTED", async () => {
  const result = await build({ limit: 5, used: 5 }).assertAvailable(tenantId, "u");
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "AI_CREDITS_EXHAUSTED");
});

test("plan exhausted but a pack has credits: allowed", async () => {
  assert.ok((await build({ limit: 5, used: 5, packs: [{ remaining: 3 }] }).assertAvailable(tenantId, "u")).ok);
});

test("plan exhausted and packs spent: refused", async () => {
  const result = await build({ limit: 5, used: 7, packs: [{ remaining: 0 }] }).assertAvailable(tenantId, "u");
  assert.equal(result.ok, false);
});

test("report mode lets it through and audits a would-block event", async () => {
  const audits = [];
  assert.ok((await build({ limit: 1, used: 1, mode: "report", audits }).assertAvailable(tenantId, "u")).ok);
  assert.equal(audits[0].eventType, "entitlement.limit_would_block");
});

test("off mode never consults entitlements", async () => {
  const gate = new AiCreditGate({ resolve: async () => { throw new Error("no"); } }, {}, { record: async () => {} }, undefined, () => "off");
  assert.ok((await gate.assertAvailable(tenantId, "u")).ok);
});
