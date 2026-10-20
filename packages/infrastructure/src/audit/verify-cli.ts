import { PrismaClient } from "@prisma/client";
import { TenantId } from "@donordesk/domain";
import { PrismaAuditRepository } from "../repositories/support.js";

/**
 * Verifies the audit hash chain.
 *   audit:verify <tenant-id>   one organisation
 *   audit:verify --all         every organisation that has audit events (needs DATABASE_ADMIN_URL: it reads across tenants)
 * One JSON line per organisation; the exit code is 1 when any chain is broken, so a scheduled run fails visibly
 * (`systemctl --failed`, the journal) instead of nobody looking. See infra/systemd/donordesk-audit-verify.timer.
 */
const arg = process.argv[2];
const all = arg === "--all";
if (!arg) {
  console.error("Usage: pnpm --filter @donordesk/infrastructure audit:verify <tenant-id> | --all");
  process.exitCode = 2;
} else {
  const databaseUrl = all ? process.env.DATABASE_ADMIN_URL : (process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL);
  if (!databaseUrl) throw new Error(all ? "DATABASE_ADMIN_URL is required for --all" : "DATABASE_ADMIN_URL or DATABASE_URL is required");
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const audits = new PrismaAuditRepository(prisma);
    const tenants = all
      ? (await prisma.auditEvent.groupBy({ by: ["tenantId"], orderBy: { tenantId: "asc" } })).map((row) => row.tenantId)
      : [arg];
    let broken = 0;
    for (const tenantId of tenants) {
      const result = await audits.verifyChain(TenantId.create(tenantId));
      console.log(JSON.stringify({ tenantId, ...result }));
      if (!result.valid) broken += 1;
    }
    if (all) console.log(JSON.stringify({ checked: tenants.length, broken }));
    if (broken > 0) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
