// Opt-in: UOW_VERIFY_DATABASE_URL=<scratch database that has had `prisma migrate deploy`>
import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { TenantId } from "@donordesk/domain";
import { PrismaFundingRepository } from "../dist/repositories/funding.js";
import { PrismaProjectRepository } from "../dist/repositories/projects.js";

const url = process.env.UOW_VERIFY_DATABASE_URL;
const skip = url ? false : "set UOW_VERIFY_DATABASE_URL to a scratch database";

test("funding: programmes, grants and placement persist, clear on null, and survive a project update", { skip }, async (t) => {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const T = `fund-${Date.now()}`;
  const tenant = TenantId.create(T);
  const funding = new PrismaFundingRepository(prisma);
  t.after(async () => {
    await prisma.project.deleteMany({ where: { tenantId: T } });
    await prisma.grant.deleteMany({ where: { tenantId: T } });
    await prisma.programme.deleteMany({ where: { tenantId: T } });
    await prisma.organization.deleteMany({ where: { tenantId: T } });
    await prisma.$disconnect();
  });

  await prisma.organization.create({ data: { id: `org-${T}`, tenantId: T, name: "Fund test", organizationType: "NGO", country: "KE", sectors: "[]", contactName: "c", contactEmail: "c@x.org" } }).catch(() => null);
  if (!(await prisma.organization.findFirst({ where: { tenantId: T } }))) return t.skip("could not create the scratch organization");

  const now = new Date();
  await funding.createProgramme({ id: `${T}-pg`, tenantId: T, name: "Horn", status: "ACTIVE", createdById: "u", createdAt: now, code: "HOA" });
  await funding.createGrant({ id: `${T}-gr`, tenantId: T, programmeId: `${T}-pg`, title: "WASH", donorName: "USAID", amount: "5000.50", currency: "USD", status: "ACTIVE", createdById: "u", createdAt: now, startDate: new Date("2026-01-01") });
  assert.equal((await funding.listGrants(tenant)).value[0].amount, "5000.50");
  assert.equal((await funding.findGrant(`${T}-gr`, TenantId.create("other-tenant"))).value, null, "another organisation cannot see it");

  await funding.updateGrant(`${T}-gr`, tenant, { title: "WASH II", donorName: "USAID", status: "CLOSED" });
  const g = (await funding.findGrant(`${T}-gr`, tenant)).value;
  assert.equal(g.title, "WASH II");
  assert.equal(g.amount, undefined, "an omitted amount is cleared, not kept");
  assert.equal(g.programmeId, undefined);

  const project = await prisma.project.create({ data: { id: `${T}-p`, tenantId: T, title: "Water", projectCode: "W-1", donorName: "USAID", implementingOrganization: "Org", country: "KE", sector: "WASH", startDate: now, endDate: new Date(now.getTime() + 86400000), reportingFrequency: "MONTHLY" } }).catch((e) => e);
  if (project instanceof Error) return t.skip(`could not create a scratch project (${String(project.message).slice(0, 80)})`);
  await funding.placeProject(`${T}-p`, tenant, { programmeId: `${T}-pg`, grantId: `${T}-gr` });
  assert.deepEqual([...(await funding.projectPlacements(tenant)).value], [[`${T}-p`, { programmeId: `${T}-pg`, grantId: `${T}-gr` }]]);

  // Project.update must not clear the placement it does not own.
  const repo = new PrismaProjectRepository(prisma);
  const loaded = (await repo.findById(`${T}-p`, tenant)).value;
  loaded.setTimeZone("Africa/Nairobi");
  await repo.update(loaded);
  assert.equal((await funding.projectPlacements(tenant)).value.get(`${T}-p`)?.grantId, `${T}-gr`);

  await funding.placeProject(`${T}-p`, tenant, { programmeId: null, grantId: null });
  assert.equal((await funding.projectPlacements(tenant)).value.size, 0);
});
