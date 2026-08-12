import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { TenantId } from "@donordesk/domain";
import { PrismaAuditRepository } from "../dist/index.js";

const databaseUrl = process.env.AUDIT_INTEGRATION_DATABASE_URL;

test("audit repository serializes concurrent appends and detects database tampering", { skip: !databaseUrl }, async () => {
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const tenant = `audit-test-${crypto.randomUUID()}`;
  const tenantId = TenantId.create(tenant);
  const repository = new PrismaAuditRepository(prisma, "test-audit-chain-key-with-at-least-32-characters");
  try {
    await Promise.all(Array.from({ length: 12 }, (_, index) => repository.record({
      tenantId,
      actorId: "integration-test",
      eventType: "audit.concurrent",
      entityType: "test",
      entityId: String(index),
    })));
    assert.deepEqual(await repository.verifyChain(tenantId), { valid: true });
    const event = await prisma.auditEvent.findFirstOrThrow({ where: { tenantId: tenant } });
    await prisma.auditEvent.update({ where: { id: event.id }, data: { actorId: "tampered" } });
    const tampered = await repository.verifyChain(tenantId);
    assert.equal(tampered.valid, false);
    assert.ok(tampered.brokenAt);
  } finally {
    await prisma.auditEvent.deleteMany({ where: { tenantId: tenant } });
    await prisma.$disconnect();
  }
});
