import assert from "node:assert/strict";
import test from "node:test";
import { JobRetryRunner, MAX_JOB_ATTEMPTS, retryDelayMs } from "../dist/jobs/retry-runner.js";
import { OutboxEventBus } from "../dist/events/outbox-event-bus.js";
import { EvidenceUploaded, TenantId } from "@donordesk/domain";

const logger = { info() {}, warn() {}, error: (m, d) => logger.errors.push([m, d]), errors: [] };

function memoryStore(jobs = []) {
  const rows = new Map(jobs.map((j) => [j.id, { attempts: 1, status: "PENDING", ...j }]));
  return {
    rows,
    record: async (i) => { rows.set(`r${rows.size}`, { id: `r${rows.size}`, jobName: i.jobName, payload: i.payload, attempts: 1, status: "PENDING", error: i.error }); },
    claimDue: async () => [...rows.values()].filter((r) => r.status === "PENDING"),
    markDone: async (id) => { rows.get(id).status = "DONE"; },
    markFailed: async (id, error, next) => { const r = rows.get(id); r.attempts += 1; r.error = error; r.next = next; if (!next) r.status = "DEAD"; },
    countDead: async () => [...rows.values()].filter((r) => r.status === "DEAD").length,
  };
}

test("H-18: the retry delay doubles from 30 s and stops at an hour", () => {
  assert.deepEqual([1, 2, 3, 4].map(retryDelayMs), [30_000, 60_000, 120_000, 240_000]);
  assert.equal(retryDelayMs(20), 60 * 60_000);
});

test("H-18: a job the queue accepts on retry is marked done", async () => {
  const store = memoryStore([{ id: "j1", jobName: "evidence.suggest_tags", payload: { evidenceId: "e1" } }]);
  const sent = [];
  const out = await new JobRetryRunner(store, { enqueue: async (n, p) => { sent.push([n, p]); } }, logger).runOnce(new Date());
  assert.deepEqual(out, { retried: 1, done: 1, failed: 0, dead: 0 });
  assert.deepEqual(sent, [["evidence.suggest_tags", { evidenceId: "e1" }]]);
  assert.equal(store.rows.get("j1").status, "DONE");
});

test("H-18: a job that keeps failing backs off, then is dead-lettered loudly", async () => {
  const store = memoryStore([{ id: "j1", jobName: "checklist.generate", payload: {} }]);
  logger.errors.length = 0;
  const runner = new JobRetryRunner(store, { enqueue: async () => { throw new Error("kestra down"); } }, logger);
  const now = new Date("2026-10-21T10:00:00Z");
  let last;
  for (let i = 1; i < MAX_JOB_ATTEMPTS; i += 1) {
    last = await runner.runOnce(now);
    if (store.rows.get("j1").status === "PENDING") assert.ok(store.rows.get("j1").next.getTime() > now.getTime());
  }
  assert.equal(store.rows.get("j1").status, "DEAD");
  assert.equal(last.dead, 1);
  assert.equal(await store.countDead(), 1);
  assert.equal(logger.errors.at(-1)[0], "job.dead_lettered");
});

test("H-18: when the queue refuses an event's job, the job is kept for retry (and a store failure cannot fail the use case)", async () => {
  const store = memoryStore();
  const bus = new OutboxEventBus(logger, { enqueue: async () => { throw new Error("HTTP 503"); } }, [
    { eventName: "evidence.uploaded", jobName: "evidence.suggest_tags", buildPayload: (e) => ({ evidenceId: e.evidenceId, tenantId: e.tenantId.toString() }) },
  ], store);
  await bus.publish([new EvidenceUploaded(TenantId.create("tenant-a"), "ev1", "p1", "u1")]);
  const kept = [...store.rows.values()];
  assert.equal(kept.length, 1);
  assert.deepEqual(kept[0].payload, { evidenceId: "ev1", tenantId: "tenant-a" });
  assert.match(kept[0].error, /503/);

  const broken = { ...store, record: async () => { throw new Error("db down"); } };
  const bus2 = new OutboxEventBus(logger, { enqueue: async () => { throw new Error("x"); } }, [
    { eventName: "evidence.uploaded", jobName: "j", buildPayload: () => ({ tenantId: "tenant-a" }) },
  ], broken);
  await bus2.publish([new EvidenceUploaded(TenantId.create("tenant-a"), "ev1", "p1", "u1")]);
});

test("H-18: nothing is kept when the queue accepts the job", async () => {
  const store = memoryStore();
  const bus = new OutboxEventBus(logger, { enqueue: async () => {} }, [
    { eventName: "evidence.uploaded", jobName: "j", buildPayload: () => ({ tenantId: "tenant-a" }) },
  ], store);
  await bus.publish([new EvidenceUploaded(TenantId.create("tenant-a"), "ev1", "p1", "u1")]);
  assert.equal(store.rows.size, 0);
});
