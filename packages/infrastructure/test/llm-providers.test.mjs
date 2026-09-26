import assert from "node:assert/strict";
import test from "node:test";
import { createLLMProvider, GEMINI_OPENAI_BASE_URL } from "../dist/llm/factory.js";
import { PlatformLlmConfigResolver } from "../dist/llm/llm-config-resolver.js";
import { describeModelAvailability } from "../dist/platform/control-plane.js";
import { AiReporterDraftGenerator } from "../dist/llm/ai-reporter-draft-generator.js";
import { StubReportDraftGenerator } from "../dist/llm/report-draft-generator.js";
import { SecretCipher } from "../dist/security/secret-cipher.js";

/**
 * SuperAdmin LLM providers: Gemini + Claude adapters, per-tenant resolution
 * (tenant's own API > platform default), model-availability check, and the
 * resolved provider reaching the AI Reporter worker.
 */

function withFetch(handler, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  return fn().finally(() => {
    globalThis.fetch = original;
  });
}

const input = { systemPrompt: "sys", userPrompt: "user", maxTokens: 4096, temperature: 0.3 };

test("gemini uses Google's OpenAI-compatible endpoint and requires a model", async () => {
  assert.throws(() => createLLMProvider({ provider: "gemini", apiKey: "g" }), /requires a model/);
  let call;
  await withFetch(
    async (url, init) => {
      call = { url: String(url), init };
      return new Response(JSON.stringify({ choices: [{ message: { content: "hello" } }], usage: { prompt_tokens: 3, completion_tokens: 1 } }), { status: 200 });
    },
    async () => {
      const provider = createLLMProvider({ provider: "gemini", model: "gemini-x", apiKey: "g-key" });
      const out = await provider.complete(input);
      assert.equal(out.text, "hello");
      assert.equal(provider.name, "gemini");
    },
  );
  assert.equal(call.url, `${GEMINI_OPENAI_BASE_URL}/chat/completions`);
  assert.equal(call.init.headers.Authorization, "Bearer g-key");
});

function claudeResponse(overrides = {}) {
  return {
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: "claude-opus-5",
    content: [{ type: "thinking", thinking: "", signature: "s" }, { type: "text", text: "{\"content\":\"ok\"}" }],
    stop_reason: "end_turn",
    stop_sequence: null,
    stop_details: null,
    usage: { input_tokens: 10, output_tokens: 5 },
    ...overrides,
  };
}

test("claude adapter uses the SDK with current-model rules (no temperature, >=16000 max_tokens, default fallbacks)", async () => {
  let call;
  await withFetch(
    async (url, init) => {
      call = { url: String(url), headers: new Headers(init.headers), body: JSON.parse(init.body) };
      return new Response(JSON.stringify(claudeResponse()), { status: 200, headers: { "content-type": "application/json" } });
    },
    async () => {
      const provider = createLLMProvider({ provider: "anthropic", apiKey: "sk-ant", effort: "medium" });
      const out = await provider.complete(input);
      assert.equal(out.text, "{\"content\":\"ok\"}");
      assert.equal(provider.model, "claude-opus-5");
    },
  );
  assert.match(call.url, /\/v1\/messages/);
  assert.equal(call.headers.get("x-api-key"), "sk-ant");
  assert.match(call.headers.get("anthropic-beta"), /server-side-fallback-2026-07-01/);
  assert.equal(call.body.fallbacks, "default");
  assert.equal(call.body.temperature, undefined);
  assert.ok(call.body.max_tokens >= 16000);
  assert.deepEqual(call.body.output_config, { effort: "medium" });
  assert.equal(call.body.system, "sys");
});

test("claude refusal is an error (the section falls back deterministically)", async () => {
  await withFetch(
    async () => new Response(JSON.stringify(claudeResponse({ content: [], stop_reason: "refusal", stop_details: { type: "refusal", category: "cyber", explanation: "x" } })), { status: 200, headers: { "content-type": "application/json" } }),
    async () => {
      const provider = createLLMProvider({ provider: "anthropic", model: "claude-haiku-4-5", apiKey: "k" });
      await assert.rejects(() => provider.complete(input), /refusal \(cyber\)/);
    },
  );
});

test("resolver: tenant's own API wins, otherwise the platform default; fingerprint tracks edits", async () => {
  const key = Buffer.alloc(32, 7);
  const enc = new SecretCipher(key).encrypt(JSON.stringify({ apiKey: "secret-1" }));
  const row = (over) => ({ id: "cfg-1", scopeType: "GLOBAL", scopeId: "GLOBAL", category: "LLM", provider: "gemini", displayName: "G", enabled: true,
    configurationJson: JSON.stringify({ model: "gemini-x" }), secretCiphertext: enc.ciphertext, secretIv: enc.iv, secretTag: enc.tag, secretVersion: 1, updatedAt: new Date("2026-09-26T10:00:00Z"), ...over });
  let rows = [row()];
  let lastArgs;
  const prisma = { $queryRawUnsafe: async (_sql, ...args) => { lastArgs = args; return rows; } };
  const resolver = new PlatformLlmConfigResolver(prisma, key);

  const global = await resolver.resolve({ tenantId: "t-1" });
  assert.equal(lastArgs[0], "t-1");
  assert.equal(global.value.provider, "gemini");
  assert.equal(global.value.apiKey, "secret-1");
  assert.equal(global.value.scope, "GLOBAL");

  rows = [row({ id: "cfg-2", scopeType: "TENANT", scopeId: "t-1", provider: "anthropic", configurationJson: JSON.stringify({ model: "claude-haiku-4-5", effort: "low" }) })];
  const tenant = await resolver.resolve({ tenantId: "t-1" });
  assert.equal(tenant.value.scope, "TENANT");
  assert.equal(tenant.value.effort, "low");
  assert.notEqual(tenant.value.fingerprint, global.value.fingerprint);

  rows = [row({ secretVersion: 2 })];
  const rotated = await resolver.resolve({ tenantId: "t-1" });
  assert.notEqual(rotated.value.fingerprint, global.value.fingerprint, "a rotated key must invalidate cached generators");
});

test("connection test checks that the configured model is available", () => {
  const body = { data: [{ id: "claude-opus-5" }, { id: "claude-haiku-4-5" }] };
  assert.equal(describeModelAvailability(body, "claude-haiku-4-5").ok, true);
  const miss = describeModelAvailability(body, "claude-3-5-haiku");
  assert.equal(miss.ok, false);
  assert.match(miss.message, /claude-opus-5/);
  assert.match(describeModelAvailability({ data: [{ id: "models/gemini-x" }] }, "gemini-x").message, /is available/);
  assert.equal(describeModelAvailability(null, "x").ok, true);
});

test("AI Reporter sends the resolved provider to the worker; the key never enters modelVersion", async () => {
  let sent;
  const worker = {
    async draftSection(request) {
      sent = request;
      return { ok: true, value: { sectionId: "s", title: "Narrative", content: "The project delivered sessions.", claims: [], sourceReferences: [], telemetry: {} } };
    },
    async rewriteSection() { throw new Error("unused"); },
    async health() { return { ok: true, value: { ok: true } }; },
  };
  const config = { provider: "anthropic", model: "claude-haiku-4-5", apiKey: "tenant-own-key", effort: undefined, baseUrl: undefined };
  const generator = new AiReporterDraftGenerator(worker, new StubReportDraftGenerator(), undefined, undefined, undefined, undefined, 4, config);
  assert.equal(generator.model.modelVersion, "anthropic/claude-haiku-4-5");
  assert.ok(!JSON.stringify(generator.model).includes("tenant-own-key"));
  const sec = { templateSectionId: "n", title: "Narrative", inputType: "NARRATIVE", required: true, mandatoryQuestions: [], evidenceNeeds: [] };
  await generator.generateSection(
    { reportPlan: { tenantId: "t", sections: [sec] }, verifiedFindings: [], evidencePackages: [], activities: [], indicatorUpdates: [], reportingProfileSnapshot: { tone: "FORMAL", language: "en", formattingRules: [], sectionOverrides: {} }, generationRunId: "r" },
    sec,
  );
  assert.deepEqual(sent.model, config);
});
