import assert from "node:assert/strict";
import test from "node:test";
import { OutboxEventBus, DEFAULT_EVENT_TO_JOB } from "../dist/index.js";
import { EvidenceUploaded, TenantId } from "@donordesk/domain";

const silentLogger = { info() {}, warn() {}, error() {}, debug() {} };

test("outbox bus maps an evidence.uploaded event to the suggest_tags job", async () => {
  let enqueued;
  const jobs = { enqueue: async (name, payload) => { enqueued = { name, payload }; } };
  const bus = new OutboxEventBus(silentLogger, jobs, DEFAULT_EVENT_TO_JOB);
  await bus.publish([new EvidenceUploaded(TenantId.create("tenant-a"), "ev-1", "proj-1", "user-1")]);
  assert.deepEqual(enqueued, { name: "evidence.suggest_tags", payload: { evidenceId: "ev-1", tenantId: "tenant-a" } });
});

test("outbox bus logs unmapped events and does not enqueue", async () => {
  let logged;
  let enqueued = 0;
  const logger = { info: (msg) => { logged = msg; }, warn() {}, error() {}, debug() {} };
  const jobs = { enqueue: async () => { enqueued += 1; } };
  const bus = new OutboxEventBus(logger, jobs, []);
  await bus.publish([new EvidenceUploaded(TenantId.create("tenant-a"), "ev-1", "proj-1", "user-1")]);
  assert.equal(logged, "domain.event");
  assert.equal(enqueued, 0);
});

test("outbox bus survives a remote enqueue failure and logs it (kestra unmapped job)", async () => {
  const errors = [];
  const logger = {
    info() {},
    warn() {},
    error: (msg, meta) => { errors.push({ msg, meta }); },
    debug() {},
  };
  const jobs = { enqueue: async () => { throw new Error("No Kestra flow mapped for job: project.workspace.provision"); } };
  const bus = new OutboxEventBus(logger, jobs, DEFAULT_EVENT_TO_JOB);
  // Must not reject: the domain write is already committed when publish runs.
  await bus.publish([new EvidenceUploaded(TenantId.create("tenant-a"), "ev-1", "proj-1", "user-1")]);
  const logged = errors.find((e) => e.msg === "outbox.enqueue_failed");
  assert.ok(logged, "expected outbox.enqueue_failed error log");
  assert.equal(logged.meta.jobName, "evidence.suggest_tags");
  assert.match(logged.meta.error, /No Kestra flow mapped/);
});
