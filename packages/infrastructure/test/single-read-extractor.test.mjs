// The single-read path: one model call for the whole document, shared by every area of the same run.
import test from "node:test";
import assert from "node:assert/strict";
import { SETUP_AREA_KEYS } from "@donordesk/domain";
import { SingleReadReader, SingleReadAreaExtractor } from "../dist/index.js";

const tenantId = "00000000-0000-4000-8000-000000000001";
// A fresh block array per run, as the orchestrator gives: the reading is memoised on this array.
const newBlocks = () => [{ documentId: "d1", index: 0, section: "", text: "Outcome 1: Improved access to water." }];

function fakeLlm(reply) {
  const calls = [];
  return {
    calls,
    async available() { return true; },
    async completeJson(input) {
      calls.push(input);
      return reply === "unavailable" ? { ok: true, value: null } : { ok: true, value: reply };
    },
  };
}

const input = (area, extra = {}, blocks = newBlocks()) => ({
  tenantId, proposalId: "p1", area, blocks, sourceText: blocks[0].text, prior: {}, maxTokens: 1000, timeoutMs: 1000, ...extra,
});

const goodReply = { text: JSON.stringify({ logframe: [{ level: "OUTCOME", title: "Improved access to water.", quote: "Outcome 1: Improved access to water." }] }), model: "m-1", promptVersion: "x", usage: { inputTokens: 10, outputTokens: 5 } };

test("every area of a run shares one model call and gets its own part", async () => {
  const llm = fakeLlm(goodReply);
  const reader = new SingleReadReader(llm);
  const areas = SETUP_AREA_KEYS.map((a) => new SingleReadAreaExtractor(a, reader));
  const shared = newBlocks();
  const results = await Promise.all(areas.map((e) => e.extract(input(e.area, {}, shared))));
  assert.equal(llm.calls.length, 1);
  assert.ok(results.every((r) => r.ok));
  const logframe = results.find((_, i) => areas[i].area === "LOGFRAME").value;
  assert.equal(logframe.fields.logframe.length, 1);
  assert.equal(logframe.model, "m-1");
});

test("only the area whose call made the reading reports its usage", async () => {
  const reader = new SingleReadReader(fakeLlm(goodReply));
  const shared = newBlocks();
  const a = await new SingleReadAreaExtractor("FACTS", reader).extract(input("FACTS", {}, shared));
  const b = await new SingleReadAreaExtractor("RISKS", reader).extract(input("RISKS", {}, shared));
  assert.ok(a.value.usage, "the first area to ask made the call and reports its usage");
  assert.equal(b.value.usage, undefined);
});

test("a focused second look (hint) asks the model for nothing", async () => {
  const llm = fakeLlm(goodReply);
  const r = await new SingleReadAreaExtractor("LOGFRAME", new SingleReadReader(llm)).extract(input("LOGFRAME", { hint: "again" }));
  assert.ok(r.ok);
  assert.deepEqual(r.value.fields, {});
  assert.equal(llm.calls.length, 0);
});

test("an unavailable model, a cut-off reply and unreadable JSON are refusals, not empty results", async () => {
  const unavailable = await new SingleReadAreaExtractor("FACTS", new SingleReadReader(fakeLlm("unavailable"))).extract(input("FACTS"));
  assert.equal(unavailable.ok, false);
  const cut = await new SingleReadAreaExtractor("FACTS", new SingleReadReader(fakeLlm({ text: "{", truncated: true }))).extract(input("FACTS"));
  assert.equal(cut.ok, false);
  const bad = await new SingleReadAreaExtractor("FACTS", new SingleReadReader(fakeLlm({ text: "not json at all" }))).extract(input("FACTS"));
  assert.equal(bad.ok, false);
});
