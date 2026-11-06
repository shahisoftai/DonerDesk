import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/donordesk";
process.env.DATABASE_ADMIN_URL ??= process.env.DATABASE_URL;
process.env.JWT_SECRET ??= "test-secret-that-is-at-least-32-characters";

const { projectScopeOf, projectOf, projectBoundaryMiddleware, ENTITY_ROUTES } = await import("../dist/middleware/project-boundary.js");

test("H-14: the project is found from the route", () => {
  assert.deepEqual(projectScopeOf("/v1/projects/p1"), { kind: "project", id: "p1" });
  assert.deepEqual(projectScopeOf("/v1/projects/p1/activities?x=1"), { kind: "project", id: "p1" });
  assert.deepEqual(projectScopeOf("/v1/reporting-periods/per1/readiness"), { kind: "entity", entity: "reportingPeriod", id: "per1" });
  assert.deepEqual(projectScopeOf("/v1/report-sections/s1/approve"), { kind: "entity", entity: "reportSection", id: "s1" });
  assert.deepEqual(projectScopeOf("/v1/evidence/e1"), { kind: "entity", entity: "evidenceFile", id: "e1" });
});

test("H-14: routes that name no single record are left to their handlers", () => {
  for (const p of ["/v1/projects", "/v1/evidence/import", "/v1/evidence/upload", "/v1/indicator-updates/bulk", "/v1/organization", "/v1/dashboard", "/v1/activities/parse-file"]) {
    assert.equal(projectScopeOf(p), null, p);
  }
  assert.ok(Object.keys(ENTITY_ROUTES).length >= 9);
});

function fakePrisma({ members = [], project = { projectManagerId: null, meOfficerId: null, reportingOfficerId: null }, rows = {} } = {}) {
  const table = (name) => ({ findFirst: async ({ where }) => rows[name]?.[where.id] ?? null });
  return {
    reportingPeriod: table("reportingPeriod"), reportDraft: table("reportDraft"), reportSection: table("reportSection"),
    reportClaim: table("reportClaim"), evidenceFile: table("evidenceFile"), activityUpdate: table("activityUpdate"),
    indicator: table("indicator"), indicatorUpdate: table("indicatorUpdate"), plannedActivity: table("plannedActivity"),
    projectMember: { findFirst: async ({ where }) => (members.includes(`${where.projectId}:${where.userId}`) ? { id: "m" } : null) },
    project: { findFirst: async ({ where }) => (where.id === "p1" ? project : null) },
  };
}
const req = (url, role, userId, prisma) => ({ url, tenant: { role, userId, tenantId: { toString: () => "t1" } }, container: { prisma } });
const run = (r) => projectBoundaryMiddleware(r, {});

test("H-14: an administrator is not checked; a member is; a removed member is refused as 'not found'", async () => {
  const prisma = fakePrisma({ members: ["p1:u1"], rows: { reportingPeriod: { per1: { projectId: "p1" } } } });
  await run(req("/v1/projects/p1", "ADMIN", "anyone", prisma));
  await run(req("/v1/projects/p1", "PROJECT_MANAGER", "u1", prisma));
  await run(req("/v1/reporting-periods/per1/draft", "ME_OFFICER", "u1", prisma));
  await assert.rejects(run(req("/v1/projects/p1", "PROJECT_MANAGER", "u2", prisma)), (e) => e.code === "NOT_FOUND");
  await assert.rejects(run(req("/v1/reporting-periods/per1/draft", "VIEWER", "u2", prisma)), (e) => e.code === "NOT_FOUND");
});

test("H-14: the project's named manager, M&E and reporting officers keep access", async () => {
  const prisma = fakePrisma({ project: { projectManagerId: "pm", meOfficerId: "me", reportingOfficerId: "ro" } });
  for (const u of ["pm", "me", "ro"]) await run(req("/v1/projects/p1/logframe", "PROJECT_MANAGER", u, prisma));
  await assert.rejects(run(req("/v1/projects/p1/logframe", "PROJECT_MANAGER", "other", prisma)));
});

test("H-14: a record that cannot be found, or a project that does not exist, passes to the handler's own 404", async () => {
  const prisma = fakePrisma();
  await run(req("/v1/reporting-periods/missing", "VIEWER", "u9", prisma));
  await run(req("/v1/projects/nope", "VIEWER", "u9", prisma));
});

test("H-14: a section and an indicator value are resolved to their project through their parents", async () => {
  const prisma = fakePrisma({ rows: { reportSection: { s1: { reportDraftId: "d1" } }, reportDraft: { d1: { projectId: "p1" } }, indicatorUpdate: { iu1: { indicatorId: "i1" } }, indicator: { i1: { projectId: "p1" } } } });
  assert.equal(await projectOf(prisma, projectScopeOf("/v1/report-sections/s1/approve")), "p1");
  assert.equal(await projectOf(prisma, projectScopeOf("/v1/indicator-updates/iu1/verify")), "p1");
  await assert.rejects(run(req("/v1/indicator-updates/iu1/verify", "ME_OFFICER", "u2", prisma)));
});
