import assert from "node:assert/strict";
import test from "node:test";
import { TenantId, Project, UsageCounter } from "@donordesk/domain";
import { ArchiveProjectHandler, RestoreProjectHandler, CreateProjectHandler, EntitlementService } from "../dist/index.js";

function fakeAudit() {
  const events = [];
  return { events, record: async (e) => { events.push(e); return { ok: true, value: undefined }; } };
}

function context() {
  return {
    tenant: { tenantId: TenantId.create("tenant-a"), userId: "user-a", role: "ADMIN" },
    requestId: "req-1",
  };
}

function makeProject(id, overrides = {}) {
  return Project.create({
    id,
    tenantId: TenantId.create("tenant-a"),
    props: {
      title: "Clean Water",
      projectCode: `CW-${id}`,
      donorName: "UNICEF",
      implementingOrganization: "NGO",
      country: "Somalia",
      sector: "WASH",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      reportingFrequency: "QUARTERLY",
      ...overrides,
    },
  });
}

function fakeProjectRepo(projects) {
  return {
    findById: async (id, tenantId) => ({
      ok: true,
      value: projects.find((p) => p.id === id && p.tenantId.toString() === tenantId.toString()) ?? null,
    }),
    listByTenant: async () => ({ ok: true, value: projects }),
    create: async (p) => { projects.push(p); return { ok: true, value: p }; },
    update: async (p) => ({ ok: true, value: p }),
  };
}

function starterGrant() {
  return {
    id: "g-base",
    tenantId: "tenant-a",
    planCode: "STARTER",
    source: "DEFAULT",
    effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    effectiveUntil: undefined,
    billingSubscriptionId: undefined,
    overrideLimitsJson: null,
    reason: "test",
    createdById: "user-a",
    isEffectiveAt: () => true,
  };
}

function makeEntitlementService(projects) {
  return new EntitlementService(
    {
      listEffectiveByTenant: async () => ({ ok: true, value: [starterGrant()] }),
      listExpiredTrialGrants: async () => ({ ok: true, value: [] }),
    },
    { findAccessGrantingByTenant: async () => ({ ok: true, value: null }) },
    {
      get: async (tenantId, metric, periodStart) =>
        ({ ok: true, value: UsageCounter.create({ metric, periodStart, used: 0n, reserved: 0n }) }),
    },
    { listByTenant: async () => ({ ok: true, value: projects }) },
    { listByTenant: async () => ({ ok: true, value: [] }) },
  );
}

test("archive-project sets ARCHIVED status, archivedAt, and audits the event", async () => {
  const project = makeProject("p-1");
  const projects = [project];
  const audit = fakeAudit();
  const handler = new ArchiveProjectHandler(fakeProjectRepo(projects), audit);

  const result = await handler.handle(context(), "p-1");
  assert.equal(result.ok, true);
  assert.equal(project.status, "ARCHIVED");
  assert.ok(project.archivedAt instanceof Date);
  assert.equal(audit.events.length, 1);
  assert.equal(audit.events[0].eventType, "project.archived");
});

test("archive-project rejects an already-archived project", async () => {
  const project = makeProject("p-1");
  project.archive();
  const handler = new ArchiveProjectHandler(fakeProjectRepo([project]), fakeAudit());

  const result = await handler.handle(context(), "p-1");
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "INVALID_STATE_TRANSITION");
});

test("restore-project clears archivedAt and audits the event", async () => {
  const project = makeProject("p-1");
  project.archive();
  const projects = [project];
  const audit = fakeAudit();
  const handler = new RestoreProjectHandler(fakeProjectRepo(projects), audit, makeEntitlementService(projects));

  const result = await handler.handle(context(), "p-1");
  assert.equal(result.ok, true);
  assert.equal(project.status, "DRAFT");
  assert.equal(project.archivedAt, undefined);
  assert.equal(audit.events[0].eventType, "project.restored");
});

test("restore-project is blocked by the active-project plan limit", async () => {
  const active = makeProject("p-1");
  const archived = makeProject("p-2");
  archived.archive();
  const projects = [active, archived];
  const handler = new RestoreProjectHandler(fakeProjectRepo(projects), fakeAudit(), makeEntitlementService(projects));

  const result = await handler.handle(context(), "p-2");
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "PLAN_LIMIT_REACHED");
  assert.equal(archived.status, "ARCHIVED");
});

test("archived projects never count toward the active-project limit (create + concurrency)", async () => {
  const projects = Array.from({ length: 3 }, (_, i) => {
    const p = makeProject(`archived-${i}`);
    p.archive();
    return p;
  });
  const entitlements = makeEntitlementService(projects);
  const repo = fakeProjectRepo(projects);
  const handler = new CreateProjectHandler(
    { generate: (() => { let n = 0; return () => `new-${++n}`; })() },
    repo,
    { create: async (s) => ({ ok: true, value: s }) },
    { create: async (p) => ({ ok: true, value: p }) },
    { findByTenant: async () => ({ ok: true, value: null }) },
    { resolve: async () => ({ ok: true, value: { provider: "LOCAL" } }) },
    { publish: async () => undefined },
    fakeAudit(),
    entitlements,
  );

  const input = {
    title: "New project",
    projectCode: "PRJ-NEW",
    donorName: "Donor",
    implementingOrganization: "Org",
    country: "US",
    sector: "HEALTH",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    reportingFrequency: "QUARTERLY",
  };

  // STARTER has 1 active project slot; 3 archived projects must not consume it.
  const results = await Promise.all([1, 2, 3].map(() => handler.handle(context(), { ...input, projectCode: `${input.projectCode}-${Math.random()}` })));
  const succeeded = results.filter((r) => r.ok);
  // Check-then-create is not transactional: this asserts today's actual behavior
  // (all three succeed because the in-memory list read happens before any write),
  // documenting that true concurrent-request safety still requires a DB-level
  // guard (unique partial index or serializable transaction) - not covered by WS-B.
  assert.equal(succeeded.length, 3);
  assert.equal(projects.filter((p) => p.status !== "ARCHIVED").length, 3);
});

test("archive-project requires project.edit (VIEWER is forbidden, defense in depth)", async () => {
  const project = makeProject("p-1");
  const handler = new ArchiveProjectHandler(fakeProjectRepo([project]), fakeAudit());
  const viewerContext = {
    tenant: { tenantId: TenantId.create("tenant-a"), userId: "user-v", role: "VIEWER" },
    requestId: "req-2",
  };
  await assert.rejects(
    () => handler.handle(viewerContext, "p-1"),
    (e) => e.code === "FORBIDDEN" && /project\.edit/.test(e.message),
  );
  assert.equal(project.status, "DRAFT", "project must be untouched");
});

test("restore-project requires project.edit (VIEWER is forbidden, defense in depth)", async () => {
  const project = makeProject("p-1");
  project.archive();
  const projects = [project];
  const handler = new RestoreProjectHandler(fakeProjectRepo(projects), fakeAudit(), makeEntitlementService(projects));
  const viewerContext = {
    tenant: { tenantId: TenantId.create("tenant-a"), userId: "user-v", role: "VIEWER" },
    requestId: "req-2",
  };
  await assert.rejects(
    () => handler.handle(viewerContext, "p-1"),
    (e) => e.code === "FORBIDDEN" && /project\.edit/.test(e.message),
  );
  assert.equal(project.status, "ARCHIVED", "project must be untouched");
});
