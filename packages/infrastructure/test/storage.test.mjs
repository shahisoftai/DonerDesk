import assert from "node:assert/strict";
import test from "node:test";
import { LocalStorage, PiiVault, withTenantSession, EvidenceChunker, PiiFirewall, ProvenanceTracker, EvaluationHarness, withPiiFirewall, createLLMProvider, CompliantModelRouter } from "../dist/index.js";
import { LlmModel } from "@donordesk/domain";

test("local storage rejects keys escaping its configured root", async () => {
  const storage = new LocalStorage();
  await assert.rejects(() => storage.read("../../etc/passwd"), /Invalid storage key/);
});

test("AI chunking rejects configurations that cannot advance", () => {
  assert.throws(() => new EvidenceChunker(10, 10), /smaller than chunk size/);
  const chunks = new EvidenceChunker(3, 1).chunk("one two three four five").chunks;
  assert.deepEqual(chunks.map((chunk) => chunk.text), ["one two three", "three four five"]);
});

test("PII firewall safely merges overlapping recognizer matches", () => {
  const firewall = new PiiFirewall();
  const text = "Identity AB1234567 and email person@example.org";
  const result = firewall.apply(text, "redact");
  assert.equal(result.redactedText?.includes("AB1234567"), false);
  assert.equal(result.redactedText?.includes("person@example.org"), false);
  assert.equal(result.matches.some((match, index) => index > 0 && match.start < result.matches[index - 1].end), false);
});

test("evaluation metrics share a zero-to-one scale", () => {
  const harness = new EvaluationHarness();
  const exact = harness.evaluate("the project reached its target", "the project reached its target", 0.9);
  assert.equal(exact.passed, true);
  assert.equal(exact.overall, 1);
  const mismatch = harness.evaluate("alpha beta gamma delta", "unrelated words entirely here", 0.6);
  assert.equal(mismatch.passed, false);
  assert.ok(mismatch.scores.every((score) => score.score >= 0 && score.score <= 1));
});

test("provenance requires valid sources and flags empty or weak claims", () => {
  const tracker = new ProvenanceTracker(0.7);
  const context = { projectId: "p", tenantId: "tenant-a", periodId: "period", generatedAt: new Date(), modelId: "m", promptVersion: 1, threshold: 0.7 };
  assert.equal(tracker.buildParagraph([], context).needsVerification, true);
  assert.equal(tracker.buildParagraph([{ text: "Claim", evidenceId: "e", chunkId: "c", score: 0.5 }], context).needsVerification, true);
  assert.throws(() => tracker.buildParagraph([{ text: "Claim", evidenceId: "", chunkId: "c", score: 0.9 }], context));
});

test("LLM provider firewall removes PII before network/provider boundaries", async () => {
  let received;
  const inner = {
    name: "test", model: "test-v1", promptVersion: "1",
    async complete(input) { received = input; return { text: "ok", model: "test-v1", promptVersion: "1", usage: { inputTokens: 1, outputTokens: 1 } }; },
  };
  await withPiiFirewall(inner, "redact").complete({ systemPrompt: "Assist person@example.org", userPrompt: "Call +1 555 123 4567" });
  assert.equal(received.systemPrompt.includes("person@example.org"), false);
  assert.equal(received.userPrompt.includes("555 123 4567"), false);
  await assert.rejects(
    () => withPiiFirewall(inner, "reject").complete({ systemPrompt: "", userPrompt: "person@example.org" }),
    /contains PII/,
  );
  assert.throws(() => createLLMProvider({ provider: "openai", apiKey: "" }), /OPENAI_API_KEY/);
});

test("LLM judge uses provider output and rejects fabricated scores", async () => {
  const harness = new EvaluationHarness();
  const result = await harness.evaluateWithLlmJudge("candidate", "faithfulness", async () => JSON.stringify({ score: 0.8, reasoning: "Grounded" }));
  assert.equal(result.score, 0.8);
  await assert.rejects(() => harness.evaluateWithLlmJudge("candidate", "faithfulness", async () => JSON.stringify({ score: 5 })), /between 0 and 1/);
});

test("model routing selects the cheapest active jurisdiction-compatible model", () => {
  const model = (id, cost, jurisdiction = "EU", active = true) => LlmModel.create({ id, props: {
    name: id, provider: "ollama", version: "1", capabilities: ["chat"], costPer1kTokens: cost,
    maxTokens: 4096, jurisdiction, isActive: active,
  } });
  const selected = new CompliantModelRouter().select([
    model("expensive", 2), model("cheap", 0.2), model("wrong-region", 0, "US"), model("inactive", 0, "EU", false),
  ], { capability: "chat", jurisdiction: "EU", requiredTokens: 1000 });
  assert.equal(selected.id, "cheap");
});

test("PII vault isolates ciphertext and search hashes by tenant and derivation salt", () => {
  const masterKey = "11".repeat(32);
  const first = new PiiVault({ masterKey, kekDerivationSalt: "22".repeat(16), residencyRegion: "EU" });
  const second = new PiiVault({ masterKey, kekDerivationSalt: "33".repeat(16), residencyRegion: "EU" });
  const encrypted = first.encrypt("person@example.org", "tenant-a");

  assert.equal(first.decrypt(encrypted.ciphertext, encrypted.iv, encrypted.authTag, "tenant-a"), "person@example.org");
  assert.throws(() => first.decrypt(encrypted.ciphertext, encrypted.iv, encrypted.authTag, "tenant-b"));
  assert.notEqual(first.hashEmail("person@example.org", "tenant-a"), first.hashEmail("person@example.org", "tenant-b"));
  assert.notEqual(first.hashEmail("person@example.org", "tenant-a"), second.hashEmail("person@example.org", "tenant-a"));
});

test("PII vault rejects an absent or undersized derivation salt", () => {
  assert.throws(
    () => new PiiVault({ masterKey: "11".repeat(32), kekDerivationSalt: "", residencyRegion: "EU" }),
    /at least 16 bytes/,
  );
});

test("replica URLs carry tenant RLS and connection attribution settings", () => {
  const scoped = new URL(withTenantSession("postgresql://app:secret@db.example/donordesk", "tenant-a"));
  assert.equal(scoped.searchParams.get("options"), "-c app.current_tenant=tenant-a -c application_name=donordesk:tenant-a");
  assert.throws(() => withTenantSession("postgresql://db.example/donordesk", "bad tenant"), /Invalid tenant/);
});
