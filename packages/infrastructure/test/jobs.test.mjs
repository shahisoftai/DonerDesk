import assert from "node:assert/strict";
import test from "node:test";
import { BullMQJobQueue, JobDispatcher, KestraJobQueue, redisConfigFromEnv } from "../dist/jobs/index.js";

const silentLogger = { info() {}, warn() {}, error() {}, debug() {} };

test("kestra queue triggers the mapped flow with token and payload", async () => {
  let captured;
  const fetchMock = async (url, opts) => {
    captured = { url, opts };
    return { ok: true, status: 200 };
  };
  const q = new KestraJobQueue({ baseUrl: "http://127.0.0.1:8080/", tenant: "main", username: "admin@example.test", password: "secret", fetchImpl: fetchMock });
  await q.enqueue("evidence.ingest", { evidenceId: "e1" });
  assert.equal(captured.url, "http://127.0.0.1:8080/api/v1/main/executions/donor_desk.phase1/evidence_ingest");
  assert.equal(captured.opts.method, "POST");
  assert.equal(captured.opts.headers.Authorization, `Basic ${Buffer.from("admin@example.test:secret").toString("base64")}`);
  assert.equal(captured.opts.body.get("evidenceId"), "e1");
});

test("kestra queue omits tenant segment when tenant is empty", async () => {
  let url;
  const q = new KestraJobQueue({ baseUrl: "http://kestra:8080", tenant: "", password: "secret", fetchImpl: async (u) => { url = u; return { ok: true }; } });
  await q.enqueue("export.run", {});
  assert.equal(url, "http://kestra:8080/api/v1/executions/donor_desk.phase1/export_on_close");
});

test("kestra queue throws on unmapped job", async () => {
  const q = new KestraJobQueue({ password: "secret", fetchImpl: async () => ({ ok: true }) });
  await assert.rejects(() => q.enqueue("nope", {}), /No Kestra flow mapped/);
});

test("kestra queue throws when basic-auth password is missing", async () => {
  const q = new KestraJobQueue({ fetchImpl: async () => ({ ok: true }) });
  await assert.rejects(() => q.enqueue("evidence.ingest", {}), /requires KESTRA_PASSWORD/);
});

test("kestra queue surfaces upstream errors", async () => {
  const q = new KestraJobQueue({ password: "secret", fetchImpl: async () => ({ ok: false, status: 500 }) });
  await assert.rejects(() => q.enqueue("evidence.ingest", {}), /HTTP 500/);
});

test("bullmq queue delegates to the priority queue seam", async () => {
  let called;
  const seam = { enqueue: async (name, data, priority) => { called = { name, data, priority }; return "job-1"; } };
  const q = new BullMQJobQueue(seam);
  await q.enqueue("export.run", { exportId: "x" });
  assert.deepEqual(called, { name: "export.run", data: { exportId: "x" }, priority: "normal" });
});

test("redisConfigFromEnv parses a URL into options", () => {
  const prev = process.env.REDIS_URL;
  process.env.REDIS_URL = "redis://dd_user:dd_pass@127.0.0.1:6380/2";
  try {
    const cfg = redisConfigFromEnv();
    assert.equal(cfg.host, "127.0.0.1");
    assert.equal(cfg.port, 6380);
    assert.equal(cfg.username, "dd_user");
    assert.equal(cfg.password, "dd_pass");
    assert.equal(cfg.db, 2);
  } finally {
    if (prev === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = prev;
  }
});

test("dispatcher runs a registered handler in memory mode", async () => {
  const calls = [];
  const d = new JobDispatcher("memory", silentLogger);
  d.register("evidence.suggest_tags", async (payload) => { calls.push(payload); });
  await d.enqueue("evidence.suggest_tags", { evidenceId: "e1" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, [{ evidenceId: "e1" }]);
});

test("dispatcher logs when memory mode has no handler", async () => {
  let logged;
  const logger = { info: (msg) => { logged = msg; }, warn() {}, error() {}, debug() {} };
  const d = new JobDispatcher("memory", logger);
  await d.enqueue("export.run", {});
  assert.equal(logged, "job.dequeued");
});

test("dispatcher delegates to a remote queue in kestra/redis mode", async () => {
  let delegated;
  const remote = { enqueue: async (name, payload) => { delegated = { name, payload }; } };
  const d = new JobDispatcher("kestra", silentLogger, remote);
  await d.enqueue("export.run", { exportId: "x" });
  assert.deepEqual(delegated, { name: "export.run", payload: { exportId: "x" } });
});
