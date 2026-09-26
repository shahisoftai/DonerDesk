import assert from "node:assert/strict";
import test from "node:test";
import { HttpWorkerClient, AI_REPORTER_DEFAULT_URL, AI_REPORTER_DEFAULT_TIMEOUT_MS } from "../dist/llm/ai-reporter-worker-client.js";

test("HttpWorkerClient defaults to the documented worker URL (127.0.0.1:8092) when AI_REPORTER_URL is unset", () => {
  const prev = process.env.AI_REPORTER_URL;
  delete process.env.AI_REPORTER_URL;
  try {
    const client = new HttpWorkerClient();
    assert.equal(client.baseUrl, AI_REPORTER_DEFAULT_URL);
    assert.equal(client.baseUrl, "http://127.0.0.1:8092");
  } finally {
    if (prev !== undefined) process.env.AI_REPORTER_URL = prev;
  }
});

test("HttpWorkerClient timeout covers the worker's draft + feedback retry (2 x 90s + 30s) by default", () => {
  const prev = { draft: process.env.AI_REPORTER_DRAFT_TIMEOUT_MS, http: process.env.AI_REPORTER_HTTP_TIMEOUT_MS };
  delete process.env.AI_REPORTER_DRAFT_TIMEOUT_MS;
  delete process.env.AI_REPORTER_HTTP_TIMEOUT_MS;
  try {
    const client = new HttpWorkerClient();
    assert.equal(client.timeoutMs, AI_REPORTER_DEFAULT_TIMEOUT_MS);
    assert.equal(client.timeoutMs, 210_000);
    // Regression: the HTTP timeout used to equal the per-call cap, so the API
    // aborted every validator retry before the worker could answer.
    process.env.AI_REPORTER_DRAFT_TIMEOUT_MS = "45000";
    assert.equal(new HttpWorkerClient().timeoutMs, 120_000);
    process.env.AI_REPORTER_HTTP_TIMEOUT_MS = "150000";
    assert.equal(new HttpWorkerClient().timeoutMs, 150_000);
  } finally {
    if (prev.draft !== undefined) process.env.AI_REPORTER_DRAFT_TIMEOUT_MS = prev.draft;
    else delete process.env.AI_REPORTER_DRAFT_TIMEOUT_MS;
    if (prev.http !== undefined) process.env.AI_REPORTER_HTTP_TIMEOUT_MS = prev.http;
    else delete process.env.AI_REPORTER_HTTP_TIMEOUT_MS;
  }
});

test("HttpWorkerClient honors explicit overrides and trims trailing slashes", () => {
  const client = new HttpWorkerClient("http://example.test:9000/", "12000", "token");
  assert.equal(client.baseUrl, "http://example.test:9000");
  assert.equal(client.timeoutMs, 12_000);
});

test("HttpWorkerClient falls back to the default timeout when the env value is malformed", () => {
  const client = new HttpWorkerClient(undefined, "not-a-number");
  assert.equal(client.timeoutMs, AI_REPORTER_DEFAULT_TIMEOUT_MS);
});

test("HttpWorkerClient.probe returns ok=false with a precise reason when the worker is unreachable", async () => {
  // 127.0.0.1:1 is reserved and unreachable — ECONNREFUSED on Linux.
  const client = new HttpWorkerClient("http://127.0.0.1:1", 5_000, "");
  const result = await client.probe();
  assert.equal(result.ok, false);
  assert.match(result.error.message, /AI Reporter health probe failed/);
  assert.match(result.error.message, /127\.0\.0\.1:1/);
});

test("HttpWorkerClient.probe returns ok=true when the worker responds 2xx", async () => {
  // Stand up a tiny HTTP server that mimics the AI Reporter /health endpoint.
  const { createServer } = await import("node:http");
  const server = createServer((req, res) => {
    if (req.url === "/v1/ai-reporter/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  try {
    const client = new HttpWorkerClient(`http://127.0.0.1:${port}`, 5_000, "secret-token");
    const result = await client.probe();
    assert.equal(result.ok, true);
    assert.equal(result.value.ok, true);
    assert.equal(result.value.baseUrl, `http://127.0.0.1:${port}`);
    assert.ok(result.value.latencyMs >= 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("HttpWorkerClient error messages include the baseUrl so logs are actionable", async () => {
  const client = new HttpWorkerClient("http://127.0.0.1:1", 5_000, "");
  const result = await client.draftSection({
    section: { title: "x", mandatoryQuestions: [] },
    context: { profile: { tone: "FORMAL", language: "en", formattingRules: [] } },
    verifiedFindings: [],
    indicatorUpdates: [],
    activities: [],
    retrievedEvidence: [],
    priorNarrative: [],
    writerContractVersion: 2,
    model: { provider: "openai" },
  });
  assert.equal(result.ok, false);
  assert.match(result.error.message, /127\.0\.0\.1:1/);
});