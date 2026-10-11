import assert from "node:assert/strict";
import test from "node:test";
import { UsageRecordingLlmProvider } from "../dist/llm/usage-recording-provider.js";
import { TemplateExtractionQuota } from "../dist/llm/template-extraction/extraction-quota.js";

const ok = (value) => ({ ok: true, value });
const context = { tenantId: "tenant-a", operationType: "TEMPLATE_EXTRACTION", promptId: "template-extractor" };
const ids = { generate: () => "run-1" };

function provider(complete) {
  return { name: "p", model: "m-1", promptVersion: "3", complete };
}

test("records tokens for a successful call and returns the result unchanged", async () => {
  const rows = [];
  const result = { text: "x", model: "m-1", promptVersion: "3", usage: { inputTokens: 10, outputTokens: 4 } };
  const wrapped = new UsageRecordingLlmProvider(provider(async () => result), { recordRun: async (r) => { rows.push(r); return ok({ id: r.id }); } }, ids, context);
  assert.equal(await wrapped.complete({ systemPrompt: "", userPrompt: "" }), result);
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].inputTokens, rows[0].outputTokens, rows[0].totalTokens, rows[0].billableUnits, rows[0].status], [10, 4, 14, 0, "success"]);
  assert.equal(rows[0].operationType, "TEMPLATE_EXTRACTION");
  assert.equal(rows[0].promptVersion, 3);
});

test("records an error row and rethrows the provider error", async () => {
  const rows = [];
  const wrapped = new UsageRecordingLlmProvider(provider(async () => { throw new Error("boom"); }), { recordRun: async (r) => { rows.push(r); return ok({ id: r.id }); } }, ids, context);
  await assert.rejects(() => wrapped.complete({ systemPrompt: "", userPrompt: "" }), /boom/);
  assert.equal(rows[0].status, "error");
  assert.equal(rows[0].errorMessage, "boom");
});

test("a failing ledger never breaks the call", async () => {
  const result = { text: "x", model: "m-1", promptVersion: "3", usage: { inputTokens: 1, outputTokens: 1 } };
  const wrapped = new UsageRecordingLlmProvider(provider(async () => result), { recordRun: async () => { throw new Error("db down"); } }, ids, context);
  assert.equal(await wrapped.complete({ systemPrompt: "", userPrompt: "" }), result);
});

test("quota: exceeded at the daily cap, open below it, open when the ledger fails", async () => {
  const now = new Date("2026-10-11T12:00:00Z");
  let since;
  const runs = (count) => ({ countRuns: async (_t, op, s) => { since = { op, s }; return ok(count); } });
  assert.equal(await new TemplateExtractionQuota(runs(60), 60, () => now).isExceeded("t"), true);
  assert.equal(since.op, "TEMPLATE_EXTRACTION");
  assert.equal(since.s.toISOString(), "2026-10-10T12:00:00.000Z");
  assert.equal(await new TemplateExtractionQuota(runs(59), 60, () => now).isExceeded("t"), false);
  const failing = { countRuns: async () => ({ ok: false, error: { code: "X", message: "x" } }) };
  assert.equal(await new TemplateExtractionQuota(failing, 60, () => now).isExceeded("t"), false);
});
