// The contract every ISetupAreaExtractor honours (Phase 36 plan §3, Liskov). Run against every registered extractor.
import assert from "node:assert/strict";
import { SETUP_AREAS, TenantId, groundAreaPatch, joinBlocks } from "@donordesk/domain";

export function fakeLlm(answer) {
  const calls = [];
  return {
    calls,
    available: async () => true,
    completeJson: async (input) => {
      calls.push(input);
      const reply = typeof answer === "function" ? answer(input, calls.length) : answer;
      return reply;
    },
  };
}

export const okReply = (json) => ({ ok: true, value: { text: typeof json === "string" ? json : JSON.stringify(json), model: "fake-model", promptVersion: "fake" } });

export async function checkExtractorContract({ makeExtractor, blocks, reply }) {
  const T = TenantId.create("tenant-contract");
  const sourceText = joinBlocks(blocks);
  const input = () => ({ tenantId: T, proposalId: "p1", blocks, sourceText, prior: {}, maxTokens: 1000, timeoutMs: 1000 });

  // 1. A good reply: fields are only the area's own, and they ground without error.
  const good = makeExtractor(fakeLlm(okReply(reply)));
  const frozen = input();
  const before = JSON.stringify(frozen);
  const result = await good.extract(frozen);
  assert.equal(result.ok, true, `${good.area}: a good reply extracts`);
  assert.equal(JSON.stringify(frozen), before, `${good.area}: the input is not mutated`);
  for (const key of Object.keys(result.value.fields)) assert.ok(SETUP_AREAS[good.area].fields.includes(key), `${good.area}: owns ${key}`);
  assert.ok(!("error" in groundAreaPatch(good.area, result.value.fields, sourceText)), `${good.area}: the patch grounds`);
  assert.ok(result.value.promptVersion, `${good.area}: names its prompt`);

  // 2. Garbage, an empty answer, a provider error, no provider: a Result error each, never a throw.
  for (const [label, answer] of [
    ["not JSON", okReply("this is not json at all")],
    ["empty", okReply("   ")],
    ["provider error", { ok: false, error: { code: "BILLING_PROVIDER_UNAVAILABLE", message: "down" } }],
    ["no provider", { ok: true, value: null }],
  ]) {
    const r = await makeExtractor(fakeLlm(answer)).extract(input());
    assert.equal(r.ok, false, `${good.area}: ${label} is an error result`);
  }

  // 3. A reply with nothing in it is an empty, valid patch (no invented items).
  const empty = await makeExtractor(fakeLlm(okReply({}))).extract(input());
  assert.equal(empty.ok, true, `${good.area}: an empty reply is not an error`);
}
