import test from "node:test";
import assert from "node:assert/strict";
import { Project, TenantId } from "@donordesk/domain";
import { PrismaProjectRepository } from "../dist/repositories/projects.js";

const project = () => Project.create({
  id: "p1", tenantId: TenantId.create("tenant-1"),
  props: { title: "ZZ test project", projectCode: "ZZT-1", donorName: "Donor", implementingOrganization: "Org", country: "Uganda", sector: "WASH", startDate: new Date("2027-01-01"), endDate: new Date("2027-12-31"), reportingFrequency: "QUARTERLY" },
});
const repoThrowing = (error) => new PrismaProjectRepository({ project: { create: async () => { throw error; }, update: async () => { throw error; } } });

test("a taken project code is answered with a sentence about the code, never the database's own message", async () => {
  const taken = Object.assign(new Error("Invalid `prisma.project.create()` invocation: Unique constraint failed on the (not available)"), { code: "P2002", meta: { target: ["tenantId", "projectCode"] } });
  for (const run of [(r) => r.create(project()), (r) => r.update(project())]) {
    const r = await run(repoThrowing(taken));
    assert.equal(r.ok, false);
    assert.equal(r.error.code, "CONFLICT");
    assert.match(r.error.message, /A project with the code "ZZT-1" already exists in this workspace/);
    assert.doesNotMatch(r.error.message, /prisma|invocation|constraint/i);
  }
});

test("any other failure is answered plainly and leaks nothing", async () => {
  const original = console.error; console.error = () => {};
  try {
    const r = await repoThrowing(new Error("connection reset by peer at 10.0.0.5")).create(project());
    assert.equal(r.ok, false);
    assert.doesNotMatch(r.error.message, /10\.0\.0\.5|connection/);
    assert.match(r.error.message, /could not be saved/);
  } finally { console.error = original; }
});
