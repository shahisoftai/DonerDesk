// The words people typed for a location, merged across plan, activity, beneficiary and indicator records, on a scratch Postgres.
// Opt-in: PLACES_VERIFY_DATABASE_URL (a database that has had `prisma migrate deploy`; rows are seeded with foreign keys off and removed afterwards).
import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { TenantId } from "@donordesk/domain";
import { PrismaPlaceUsageReader } from "../dist/repositories/places.js";

const url = process.env.PLACES_VERIFY_DATABASE_URL;
const skip = url ? false : "PLACES_VERIFY_DATABASE_URL not set";
const TENANTS = ["tenant-pu", "tenant-pu-other"];
const now = new Date("2026-11-05T08:00:00Z");

async function seed(prisma) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("set local session_replication_role = replica");
    const plan = (id, tenantId, location) => tx.$executeRaw`insert into "PlannedActivity" (id, "tenantId", "projectId", title, "plannedStart", "plannedEnd", "originalStart", "originalEnd", "createdById", "updatedAt", location) values (${id}, ${tenantId}, 'p', 't', '2026-01-01', '2026-01-02', '2026-01-01', '2026-01-02', 'u', ${now}, ${location})`;
    const activity = (id, tenantId, location) => tx.$executeRaw`insert into "ActivityUpdate" (id, "tenantId", "projectId", "reportingPeriodId", "activityTitle", "activityDate", summary, "submittedById", "updatedAt", location) values (${id}, ${tenantId}, 'p', 'rp', 't', ${now}, 's', 'u', ${now}, ${location})`;
    const person = (id, tenantId, location) => tx.$executeRaw`insert into "Beneficiary" (id, "tenantId", "projectId", "caseCode", sex, "ageGroup", "enrolledOn", "consentRecordedById", "createdById", location) values (${id}, ${tenantId}, 'p', ${id}, 'F', '18-59', '2026-01-01', 'u', 'u', ${location})`;
    const value = (id, tenantId, json) => tx.$executeRaw`insert into "IndicatorUpdate" (id, "tenantId", "indicatorId", "reportingPeriodId", "periodAchievement", "cumulativeAchievement", "createdById", "updatedAt", "disaggregationJson") values (${id}, ${tenantId}, 'i', ${id}, '1', '1', 'u', ${now}, ${json})`;

    await plan("pa1", "tenant-pu", "Gulu");
    await plan("pa2", "tenant-pu", "  gulu ");
    await plan("pa3", "tenant-pu", null);
    await plan("pa4", "tenant-pu-other", "Gulu");
    await activity("au1", "tenant-pu", "Gulu");
    await activity("au2", "tenant-pu", "Kitgum");
    await activity("au3", "tenant-pu", "   ");
    await person("b1", "tenant-pu", "Kitgum");
    await person("b2", "tenant-pu", "");
    await value("iu1", "tenant-pu", JSON.stringify([{ dimension: "LOCATION", category: "Gulu" }, { dimension: "SEX", category: "Female" }, { dimension: "LOCATION", category: "Lira" }]));
    await value("iu2", "tenant-pu", "not json");
    await value("iu3", "tenant-pu", "[]");
    await value("iu4", "tenant-pu", JSON.stringify({ dimension: "LOCATION", category: "Mbale" }));
    await value("iu5", "tenant-pu-other", JSON.stringify([{ dimension: "LOCATION", category: "Arua" }]));
  });
}

const clean = (prisma) => Promise.all([
  prisma.plannedActivity.deleteMany({ where: { tenantId: { in: TENANTS } } }),
  prisma.activityUpdate.deleteMany({ where: { tenantId: { in: TENANTS } } }),
  prisma.beneficiary.deleteMany({ where: { tenantId: { in: TENANTS } } }),
  prisma.indicatorUpdate.deleteMany({ where: { tenantId: { in: TENANTS } } }),
]);

const withDb = (fn) => async () => {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try { await clean(prisma); await seed(prisma); await fn(prisma); } finally { await clean(prisma); await prisma.$disconnect(); }
};

const shape = (rows) => rows
  .map((r) => ({ key: r.text.trim().toLowerCase(), sources: [...r.sources].sort(), count: r.count }))
  .sort((a, b) => a.key.localeCompare(b.key));

test("locations merge case-insensitively across the four sources and count every record", { skip }, withDb(async (prisma) => {
  const out = await new PrismaPlaceUsageReader(prisma).distinctLocations(TenantId.create("tenant-pu"));
  assert.equal(out.ok, true);
  assert.deepEqual(shape(out.value), [
    { key: "gulu", sources: ["ACTIVITY", "INDICATOR", "PLAN"], count: 4 },
    { key: "kitgum", sources: ["ACTIVITY", "BENEFICIARY"], count: 2 },
    { key: "lira", sources: ["INDICATOR"], count: 1 },
  ]);
}));

test("another organisation's words are never read", { skip }, withDb(async (prisma) => {
  const out = await new PrismaPlaceUsageReader(prisma).distinctLocations(TenantId.create("tenant-pu-other"));
  assert.deepEqual(shape(out.value), [
    { key: "arua", sources: ["INDICATOR"], count: 1 },
    { key: "gulu", sources: ["PLAN"], count: 1 },
  ]);
}));

test("an organisation with no records gets an empty list", { skip }, withDb(async (prisma) => {
  const out = await new PrismaPlaceUsageReader(prisma).distinctLocations(TenantId.create("tenant-pu-none"));
  assert.deepEqual(out.value, []);
}));
