import { PrismaClient } from "@prisma/client";
import { TenantId } from "@donordesk/domain";
import { PrismaAuditRepository } from "../repositories/support.js";

const tenantId = process.argv[2];
if (!tenantId) {
  console.error("Usage: pnpm --filter @donordesk/infrastructure audit:verify <tenant-id>");
  process.exitCode = 2;
} else {
  const databaseUrl = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_ADMIN_URL or DATABASE_URL is required");
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const result = await new PrismaAuditRepository(prisma).verifyChain(TenantId.create(tenantId));
    console.log(JSON.stringify({ tenantId, ...result }));
    if (!result.valid) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
