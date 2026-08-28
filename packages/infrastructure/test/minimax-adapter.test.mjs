import assert from "node:assert/strict";
import test from "node:test";
import { createMiniMaxAdapter } from "../dist/llm/adapters/minimax.js";

test("MiniMax Text-01 sends a JSON schema when JSON mode is requested", async (t) => {
  let requestBody;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    requestBody = JSON.parse(init.body);
    return new Response(JSON.stringify({
      choices: [{ message: { content: '{"sections":[{"title":"A","content":"B"}]}' } }],
      usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
      base_resp: { status_code: 0 },
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const provider = createMiniMaxAdapter({ apiKey: "test", model: "MiniMax-Text-01" });
  const result = await provider.complete({ systemPrompt: "system", userPrompt: "user", jsonMode: true });

  assert.equal(requestBody.response_format.type, "json_schema");
  assert.equal(requestBody.response_format.json_schema.name, "donordesk_report_sections");
  assert.deepEqual(requestBody.response_format.json_schema.schema.required, ["sections"]);
  assert.deepEqual(result.usage, { inputTokens: 12, outputTokens: 8 });
});

test("MiniMax does not send unsupported JSON schema to other models", async (t) => {
  let requestBody;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    requestBody = JSON.parse(init.body);
    return new Response(JSON.stringify({ choices: [{ message: { content: "text" } }] }), { status: 200 });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const provider = createMiniMaxAdapter({ apiKey: "test", model: "MiniMax-M2.7" });
  await provider.complete({ systemPrompt: "system", userPrompt: "user", jsonMode: true });
  assert.equal(requestBody.response_format, undefined);
});
