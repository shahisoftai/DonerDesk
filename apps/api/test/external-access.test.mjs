import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/donordesk";
process.env.DATABASE_ADMIN_URL ??= process.env.DATABASE_URL;
process.env.JWT_SECRET ??= "test-secret-that-is-at-least-32-characters";

const { isExternalAllowed, externalAccessMiddleware, EXTERNAL_ALLOWED } = await import("../dist/middleware/external-access.js");
const { bodyScopes, projectBoundaryMiddleware, assertProjectAccess } = await import("../dist/middleware/project-boundary.js");
const { RULES } = await import("../dist/middleware/authorization.js");

test("H-15: a partner reaches their projects, reporting and evidence, and nothing organisation-wide", () => {
  const yes = [["GET", "/v1/projects"], ["GET", "/v1/projects/p1"], ["GET", "/v1/projects/p1/logframe"], ["POST", "/v1/activities"], ["POST", "/v1/evidence/upload"],
    ["GET", "/v1/evidence/e1"], ["POST", "/v1/indicator-updates/bulk"], ["GET", "/v1/reporting-periods/per1/indicators"], ["GET", "/v1/notifications"], ["HEAD", "/v1/projects/p1"]];
  for (const [m, p] of yes) assert.equal(isExternalAllowed(m, p), true, `${m} ${p}`);
  const no = [["GET", "/v1/users"], ["POST", "/v1/users/invite"], ["GET", "/v1/organization/export"], ["GET", "/v1/funding"], ["GET", "/v1/audit-log"], ["GET", "/v1/billing/summary"],
    ["GET", "/v1/comments"], ["POST", "/v1/exports"], ["GET", "/v1/evidence"], ["GET", "/v1/portfolio/indicators"], ["PUT", "/v1/projects/p1"], ["DELETE", "/v1/projects/p1"],
    ["POST", "/v1/report-sections/s1/approve"], ["GET", "/v1/projects/p1/members"], ["GET", "/v1/projects/p1/logframe/versions"], ["GET", "/v1/dashboard"], ["POST", "/v1/projects/p1/funding"]];
  for (const [m, p] of no) assert.equal(isExternalAllowed(m, p), false, `${m} ${p}`);
});

test("H-15: every route a partner is allowed also has an ordinary authorisation rule (the allow-list narrows, it never widens)", () => {
  const samples = [["GET", "/v1/projects"], ["GET", "/v1/projects/p1"], ["GET", "/v1/projects/p1/logframe"], ["GET", "/v1/projects/p1/activities"], ["GET", "/v1/projects/p1/reporting-periods"],
    ["GET", "/v1/organization"], ["GET", "/v1/notifications"], ["GET", "/v1/me/week"], ["GET", "/v1/legal/consent"], ["POST", "/v1/legal/consent"], ["POST", "/v1/notifications/n1/read"],
    ["POST", "/v1/activities"], ["GET", "/v1/activities/a1"], ["POST", "/v1/evidence/upload"], ["GET", "/v1/evidence/e1"], ["GET", "/v1/files/k1"],
    ["GET", "/v1/reporting-periods/per1/indicators"], ["POST", "/v1/indicator-updates"], ["POST", "/v1/indicator-updates/bulk"]];
  for (const [m, p] of samples) {
    assert.equal(isExternalAllowed(m, p), true, `${m} ${p} should be allowed for a partner`);
    assert.ok(RULES.some((r) => r.method === m && r.route.test(p)), `${m} ${p} has no authorisation rule`);
  }
  // ...and every pattern in the allow-list is exercised by a sample, so an unused (or typo'd) pattern shows up.
  for (const rule of EXTERNAL_ALLOWED) assert.ok(samples.some(([m, p]) => rule.method === m && rule.route.test(p)), `${rule.method} ${rule.route} matches no sample`);
});

const req = (method, url, tenant, container = {}) => ({ method, url, tenant: { tenantId: { toString: () => "t1" }, userId: "u1", role: "FIELD_OFFICER", ...tenant }, container, body: undefined });

test("H-15: the middleware only restricts external users, and says plainly what the account is for", async () => {
  await externalAccessMiddleware(req("GET", "/v1/users", {}), {});
  await assert.rejects(externalAccessMiddleware(req("GET", "/v1/users", { external: true }), {}), /projects you were given/);
  await externalAccessMiddleware(req("GET", "/v1/projects/p1", { external: true }), {});
});

test("H-15: a file is reachable only when it belongs to a project the partner is on", async () => {
  const container = (evidence, member) => ({ prisma: { evidenceFile: { findFirst: async () => evidence }, projectMember: { findFirst: async () => member } } });
  await externalAccessMiddleware(req("GET", "/v1/files/key1", { external: true }, container({ projectId: "p1" }, { id: "m" })), {});
  await assert.rejects(externalAccessMiddleware(req("GET", "/v1/files/key1", { external: true }, container({ projectId: "p2" }, null)), {}), (e) => e.code === "NOT_FOUND");
  await assert.rejects(externalAccessMiddleware(req("GET", "/v1/files/nokey", { external: true }, container(null, null)), {}), (e) => e.code === "NOT_FOUND");
});

test("H-14/15: the project named in a JSON body is checked like one in the path", async () => {
  assert.deepEqual(bodyScopes({ projectId: "p1", reportingPeriodId: "per1", indicatorId: "i1", other: 1 }), [
    { kind: "project", id: "p1" }, { kind: "entity", entity: "reportingPeriod", id: "per1" }, { kind: "entity", entity: "indicator", id: "i1" }]);
  assert.deepEqual(bodyScopes(null), []);
  assert.deepEqual(bodyScopes("x"), []);
  const prisma = {
    projectMember: { findFirst: async ({ where }) => (where.projectId === "p1" ? { id: "m" } : null) },
    project: { findFirst: async ({ where }) => ({ id: where.id, projectManagerId: null, meOfficerId: null, reportingOfficerId: null }) },
    reportingPeriod: { findFirst: async ({ where }) => (where.id === "per2" ? { projectId: "p2" } : { projectId: "p1" }) },
  };
  const r = (url, body, role = "FIELD_OFFICER") => ({ url, body, tenant: { tenantId: { toString: () => "t1" }, userId: "u1", role }, container: { prisma } });
  await projectBoundaryMiddleware(r("/v1/activities", { projectId: "p1" }), {});
  await assert.rejects(projectBoundaryMiddleware(r("/v1/activities", { projectId: "p2" }), {}), (e) => e.code === "NOT_FOUND");
  await assert.rejects(projectBoundaryMiddleware(r("/v1/indicator-updates/bulk", { reportingPeriodId: "per2", updates: [] }), {}), (e) => e.code === "NOT_FOUND");
  await projectBoundaryMiddleware(r("/v1/activities", { projectId: "p2" }, "ADMIN"), {});
  await assertProjectAccess(r("/x", {}), "p1");
  await assert.rejects(assertProjectAccess(r("/x", {}), "p2"));
  await assertProjectAccess(r("/x", {}), undefined);
});
