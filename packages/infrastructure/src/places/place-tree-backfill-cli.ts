import { PrismaClient } from "@prisma/client";
import { backfillTenant } from "./place-tree-backfill.js";

/**
 * `pnpm --filter @donordesk/infrastructure places:backfill [--apply] [--tenant=<id>]` (Phase 56). Dry run by default: prints what would be
 * linked per organisation. Run as the migrator (DATABASE_ADMIN_URL, which bypasses row-level security). Idempotent; never rewrites typed text.
 */
async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const only = process.argv.find((a) => a.startsWith("--tenant="))?.slice("--tenant=".length);
  const url = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
  const prisma = new PrismaClient(url ? { datasources: { db: { url } } } : undefined);
  try {
    const tenants = only ? [{ tenantId: only }] : await prisma.organization.findMany({ select: { tenantId: true } });
    for (const { tenantId } of tenants) {
      const r = await backfillTenant(prisma, tenantId, { apply, actorId: "system:places-backfill", now: new Date() });
      console.log(`${apply ? "" : "[dry run] "}${tenantId}: ${r.projects} projects, +${r.areasAdded} areas, activities ${r.activitiesInherited} inherited / ${r.activitiesLinked} linked, files ${r.evidenceInherited} inherited / ${r.evidenceLinked} linked, people ${r.beneficiariesLinked}, value entries ${r.valueEntriesLinked}, left to confirm ${r.leftToConfirm}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((e) => { console.error(e); process.exit(1); });
