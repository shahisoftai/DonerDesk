// Opt-in: needs a scratch Postgres that has had `prisma migrate deploy` applied.
//   UOW_VERIFY_DATABASE_URL=postgresql://user@localhost/scratch?host=/var/run/postgresql node --test test/unit-of-work.integration.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { TenantId } from "@donordesk/domain";
import { UnitOfWork } from "../dist/db/unit-of-work.js";
import { PrismaAuditRepository } from "../dist/repositories/support.js";

const url = process.env.UOW_VERIFY_DATABASE_URL;
const skip = url ? false : "set UOW_VERIFY_DATABASE_URL to a scratch database";
const tenant = `uow-${Date.now()}`;

test("a unit of work commits or rolls back the business write and its audit row together", { skip }, async (t) => {
  const base = new PrismaClient({ datasources: { db: { url } } });
  const uow = new UnitOfWork(base);
  const prisma = uow.client;
  const audit = new PrismaAuditRepository(prisma, "k".repeat(40));
  const tenantId = TenantId.create(tenant);
  const note = (id) => prisma.notification.create({ data: { id, tenantId: tenant, recipientId: "u", type: "ASSIGNMENT", title: "t", message: "m" } });
  const record = (entityId) => audit.record({ tenantId, actorId: "u", eventType: "test.event", entityType: "notification", entityId });
  const counts = async () => ({
    notes: await base.notification.count({ where: { tenantId: tenant } }),
    audits: await base.auditEvent.count({ where: { tenantId: tenant } }),
  });
  t.after(async () => {
    await base.notification.deleteMany({ where: { tenantId: tenant } });
    await base.auditEvent.deleteMany({ where: { tenantId: tenant } });
    await base.$disconnect();
  });

  await t.test("a throw after the audit write undoes both", async () => {
    const tasks = [];
    await assert.rejects(uow.run(async () => {
      await note("n1");
      await record("n1");
      UnitOfWork.afterCommit(() => tasks.push("ran"));
      throw new Error("boom");
    }), /boom/);
    assert.deepEqual(await counts(), { notes: 0, audits: 0 });
    assert.deepEqual(tasks, [], "after-commit work never runs for a rolled-back unit");
  });

  await t.test("a failure inside the audit write undoes the business write", async () => {
    const broken = new PrismaAuditRepository(prisma, "k".repeat(40));
    await assert.rejects(uow.run(async () => {
      await note("n2");
      await broken.create({ id: "a-bad", tenantId: tenant, actorId: null, eventType: "x", entityType: "x", entityId: "x" });
    }));
    assert.deepEqual(await counts(), { notes: 0, audits: 0 });
  });

  await t.test("a normal run commits both, in order, and the chain verifies", async () => {
    const tasks = [];
    await uow.run(async () => {
      await note("n3");
      await record("n3");
      await uow.run(async () => { await record("n3-nested"); }); // joins, does not open a second transaction
      UnitOfWork.afterCommit(() => tasks.push(counts()));
      assert.equal(UnitOfWork.active(), true);
    });
    assert.equal(UnitOfWork.active(), false);
    assert.deepEqual(await counts(), { notes: 1, audits: 2 });
    assert.deepEqual(await tasks[0], { notes: 1, audits: 2 }, "after-commit work sees the committed rows");
    assert.deepEqual(await audit.verifyChain(tenantId), { valid: true });
  });

  await t.test("a returned failure commits what was written, as before", async () => {
    const result = await uow.run(async () => { await note("n4"); return { ok: false, error: "refused" }; });
    assert.equal(result.ok, false);
    assert.equal((await counts()).notes, 2);
  });

  await t.test("outside a unit of work the client behaves as the plain client", async () => {
    await note("n5");
    assert.equal((await counts()).notes, 3);
    assert.equal(typeof prisma.$disconnect, "function");
  });
});
