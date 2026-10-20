// Opt-in: UOW_VERIFY_DATABASE_URL=<scratch database that has had `prisma migrate deploy`>
import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { PrismaFailedJobStore } from "../dist/repositories/failed-jobs.js";
import { JobRetryRunner } from "../dist/jobs/retry-runner.js";

const url = process.env.UOW_VERIFY_DATABASE_URL;
const skip = url ? false : "set UOW_VERIFY_DATABASE_URL to a scratch database";

test("the failed-job store keeps, claims once, retries and dead-letters", { skip }, async (t) => {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const store = new PrismaFailedJobStore(prisma);
  t.after(async () => { await prisma.jobOutbox.deleteMany({ where: { tenantId: "jobs-test" } }); await prisma.$disconnect(); });
  const now = new Date("2026-10-21T10:00:00Z");

  await store.record({ tenantId: "jobs-test", jobName: "evidence.suggest_tags", payload: { evidenceId: "e1", tenantId: "jobs-test" }, error: "HTTP 503", now });
  assert.deepEqual(await store.claimDue(new Date(now.getTime() + 10_000), 10), [], "not due before the first backoff");
  const due = new Date(now.getTime() + 31_000);
  const claimed = await store.claimDue(due, 10);
  assert.equal(claimed.length, 1);
  assert.deepEqual(claimed[0].payload, { evidenceId: "e1", tenantId: "jobs-test" });
  assert.deepEqual(await store.claimDue(due, 10), [], "a claimed job is held, so a second runner does not repeat it");

  // A queue that is still down: back off; then up: done.
  await prisma.jobOutbox.updateMany({ where: { tenantId: "jobs-test" }, data: { nextAttemptAt: now } });
  const logger = { info() {}, warn() {}, error() {} };
  const down = await new JobRetryRunner(store, { enqueue: async () => { throw new Error("down"); } }, logger).runOnce(due);
  assert.deepEqual(down, { retried: 1, done: 0, failed: 1, dead: 0 });
  await prisma.jobOutbox.updateMany({ where: { tenantId: "jobs-test" }, data: { nextAttemptAt: now } });
  const sent = [];
  const up = await new JobRetryRunner(store, { enqueue: async (n) => { sent.push(n); } }, logger).runOnce(due);
  assert.deepEqual(up, { retried: 1, done: 1, failed: 0, dead: 0 });
  assert.deepEqual(sent, ["evidence.suggest_tags"]);
  assert.equal((await prisma.jobOutbox.findFirst({ where: { tenantId: "jobs-test" } })).status, "DONE");

  await store.record({ tenantId: "jobs-test", jobName: "j", payload: {}, error: "x", now });
  const row = await prisma.jobOutbox.findFirst({ where: { tenantId: "jobs-test", status: "PENDING" } });
  await store.markFailed(row.id, "gave up", null);
  assert.equal(await store.countDead() >= 1, true);
});
