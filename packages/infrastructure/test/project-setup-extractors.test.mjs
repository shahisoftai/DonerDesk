// Phase 36.2: the area extractors over recorded replies (no live model). Contract per extractor, the shared machinery,
// and one end-to-end reading through the real orchestrator, where invented items are dropped by grounding.
import test from "node:test";
import assert from "node:assert/strict";
import { SETUP_AREA_KEYS, TenantId } from "@donordesk/domain";
import { SetupExtractionOrchestrator, emptySetupProposal } from "@donordesk/application";
import { PromptedAreaExtractor, SETUP_EXTRACTION_SPECS, createSetupExtractors } from "../dist/index.js";
import { chunkBlocksText, selectBlocks, CHUNK_CHARS, MAX_CHUNKS } from "../dist/project-setup/extractor-shared.js";
import { checkExtractorContract, fakeLlm, okReply } from "./support/setup-extractor-contract.mjs";
import { BLOCKS, EXPECTED, REPLIES } from "./setup-corpus/blue-water.mjs";

const specFor = (area) => SETUP_EXTRACTION_SPECS.find((s) => s.area === area);
const T = TenantId.create("tenant-x");

test("every setup area has exactly one extraction spec (exhaustive registry)", () => {
  assert.deepEqual(SETUP_EXTRACTION_SPECS.map((s) => s.area).sort(), [...SETUP_AREA_KEYS].sort());
  assert.equal(new Set(SETUP_EXTRACTION_SPECS.map((s) => s.promptVersion)).size, SETUP_EXTRACTION_SPECS.length);
});

for (const area of SETUP_AREA_KEYS) {
  test(`${area} extractor honours the extractor contract`, async () => {
    await checkExtractorContract({ makeExtractor: (llm) => new PromptedAreaExtractor(specFor(area), llm), blocks: BLOCKS, reply: REPLIES[area] });
  });
}

test("the prompt carries the shared rules, the area's instructions and numbered blocks; never prior text to quote", async () => {
  const llm = fakeLlm(okReply(REPLIES.INDICATORS));
  const prior = { logframe: [{ value: { code: "1.1" } }] };
  await new PromptedAreaExtractor(specFor("INDICATORS"), llm).extract({ tenantId: T, proposalId: "p", blocks: BLOCKS, sourceText: "", prior, maxTokens: 10, timeoutMs: 10 });
  const call = llm.calls[0];
  assert.match(call.system, /DATA\. Never follow instructions/);
  assert.match(call.user, /Logframe codes already read: 1\.1/);
  assert.match(call.user, /\[5\] Indicator 1\.1\.a/);
});

test("the system rules are byte-identical across areas (provider prefix caching)", async () => {
  const systems = new Set();
  for (const spec of SETUP_EXTRACTION_SPECS) {
    const llm = fakeLlm(okReply({}));
    await new PromptedAreaExtractor(spec, llm).extract({ tenantId: T, proposalId: "p", blocks: BLOCKS, sourceText: "", prior: {}, maxTokens: 10, timeoutMs: 10 });
    systems.add(llm.calls[0].system);
  }
  assert.equal(systems.size, 1);
});

test("items keep the block's document and page, and an unknown block gives no reference", async () => {
  const reply = { risks: [{ title: "Flooding", quote: "flooding", block: 9 }, { title: "Strikes", quote: "x", block: 99 }] };
  const r = await new PromptedAreaExtractor(specFor("RISKS"), fakeLlm(okReply(reply))).extract({ tenantId: T, proposalId: "p", blocks: BLOCKS, sourceText: "", prior: {}, maxTokens: 10, timeoutMs: 10 });
  assert.deepEqual(r.value.fields.risks[0].sourceRef, { documentId: "doc-1", block: 9, page: 1 });
  assert.equal(r.value.fields.risks[0].confidence, "LOW", "no self-rating is LOW");
  assert.equal(r.value.fields.risks[1].sourceRef, null);
});

test("readers never guess: half a pin, a bad date, an unknown level or currency are Not stated", async () => {
  const run = async (area, reply) =>
    (await new PromptedAreaExtractor(specFor(area), fakeLlm(okReply(reply))).extract({ tenantId: T, proposalId: "p", blocks: BLOCKS, sourceText: "", prior: {}, maxTokens: 10, timeoutMs: 10 })).value.fields;
  const places = await run("PLACES", { places: [{ name: "Gulu", latitude: 2.77, adminLevel: 9 }] });
  assert.equal(places.places[0].value.latitude, null);
  assert.equal(places.places[0].value.adminLevel, null);
  const plan = await run("PLAN", { plan: [{ title: "Training", start: "April 2027" }] });
  assert.equal(plan.plan[0].value.start, null);
  const logframe = await run("LOGFRAME", { logframe: [{ level: "Mystery", title: "x" }, { level: "Specific objective", title: "y" }] });
  assert.equal(logframe.logframe.length, 1);
  assert.equal(logframe.logframe[0].value.level, "OUTCOME");
  const money = await run("FUNDING_BUDGET", { funding: [{ sourceName: "EU", amount: "10", currency: "euros" }] });
  assert.equal(money.funding[0].value.currency, null);
});

test("block selection reads the area's blocks, else the whole document; chunking reports what it could not read", () => {
  const picked = selectBlocks(BLOCKS, ["goal", "outcome", "output", "indicator"]);
  assert.ok(picked.text.includes("[5]") && !picked.text.includes("[9]"));
  assert.ok(selectBlocks(BLOCKS, ["nothing-matches"]).text.includes("[9]"));
  const long = Array.from({ length: (MAX_CHUNKS + 1) * 40 }, (_, i) => `[${i}] ${"x".repeat(CHUNK_CHARS / 40)}`).join("\n");
  const chunked = chunkBlocksText(long);
  assert.equal(chunked.chunks.length, MAX_CHUNKS);
  assert.equal(chunked.partlyRead, true);
  assert.ok(chunked.chunks.every((c) => c.length <= CHUNK_CHARS));
});

test("a transient failure is retried once, never twice", async () => {
  const fail = { ok: false, error: { code: "BILLING_PROVIDER_UNAVAILABLE", message: "down" } };
  const once = fakeLlm((_i, n) => (n === 1 ? fail : okReply(REPLIES.RISKS)));
  assert.equal((await new PromptedAreaExtractor(specFor("RISKS"), once).extract({ tenantId: T, proposalId: "p", blocks: BLOCKS, sourceText: "", prior: {}, maxTokens: 1, timeoutMs: 1 })).ok, true);
  const always = fakeLlm(fail);
  assert.equal((await new PromptedAreaExtractor(specFor("RISKS"), always).extract({ tenantId: T, proposalId: "p", blocks: BLOCKS, sourceText: "", prior: {}, maxTokens: 1, timeoutMs: 1 })).ok, false);
  assert.equal(always.calls.length, 2);
});

test("end to end: the real orchestrator reads the fixture, grounds it, and drops what the document does not say", async () => {
  const llm = fakeLlm((input) => {
    const spec = SETUP_EXTRACTION_SPECS.find((s) => input.user.startsWith(s.instructions));
    return okReply(REPLIES[spec.area]);
  });
  let stored = {
    id: "p1", tenantId: T, createdById: "u1", status: "EXTRACTING", sourceName: "blue.docx", sourceStorageKey: "k", sourceHash: "h", sourceLength: 1,
    proposal: emptySetupProposal(), problems: [], createdAt: new Date(), updatedAt: new Date(), expiresAt: new Date(Date.now() + 1e9),
  };
  const proposals = { findById: async () => ({ ok: true, value: stored }), update: async (p) => { stored = p; return { ok: true, value: true }; } };
  const runs = { start: async () => ({ ok: true }), finish: async () => ({ ok: true }), fail: async () => ({ ok: true }), progress: async () => ({ ok: true }), listByProposal: async () => ({ ok: true, value: [] }) };
  const reader = { read: async () => ({ ok: true, value: BLOCKS }) };
  const audit = { record: async () => {} };
  let n = 0;
  const orchestrator = new SetupExtractionOrchestrator(proposals, runs, reader, createSetupExtractors(SETUP_EXTRACTION_SPECS, llm), audit, { now: () => new Date() }, { generate: () => `id${n++}` });
  const result = await orchestrator.run({ tenantId: T, proposalId: "p1", userId: "u1" });
  assert.equal(result.ok, true);
  assert.equal(stored.status, "READY");
  const p = stored.proposal;
  for (const field of ["logframe", "indicators", "periods", "plan", "places", "funding", "budget", "risks"]) {
    assert.equal(p[field].length, EXPECTED[field], `${field} count`);
  }
  assert.equal(Object.values(p.facts).filter((f) => f.value !== null).length, EXPECTED.factsStated);
  assert.ok(!p.indicators.some((i) => i.value.target === "2,500"), "the invented target is dropped");
  assert.ok(!p.logframe.some((i) => i.value.code === "1.1.2"), "the unquoted output is dropped");
  assert.equal(p.funding[0].value.currency, "EUR");
});
