import assert from "node:assert/strict";
import test from "node:test";
import { TenantId, Project, UsageCounter } from "@donordesk/domain";
import {
  CreateDemoProjectHandler,
  DeleteDemoProjectHandler,
  EntitlementService,
} from "../dist/index.js";

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

function fakeIdGenerator() {
  let n = 0;
  return { generate: () => `id-${++n}` };
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

function fakeCreateOnly() {
  return { create: async (x) => ({ ok: true, value: x }) };
}

test("create-demo-project seeds a reporting-ready isDemo project", async () => {
  const projects = [];
  const handler = new CreateDemoProjectHandler(
    fakeIdGenerator(),
    fakeProjectRepo(projects),
    fakeCreateOnly(),
    fakeCreateOnly(),
    fakeCreateOnly(),
    fakeCreateOnly(),
    fakeCreateOnly(),
    fakeAudit(),
  );

  const result = await handler.handle(context());
  assert.equal(result.ok, true);
  assert.equal(result.value.reused, false);
  assert.equal(projects.length, 1);
  assert.equal(projects[0].isDemo, true);
});

test("create-demo-project is idempotent: a second call reuses the existing demo project", async () => {
  const existing = makeProject("demo-1", { isDemo: true });
  const projects = [existing];
  const handler = new CreateDemoProjectHandler(
    fakeIdGenerator(),
    fakeProjectRepo(projects),
    fakeCreateOnly(),
    fakeCreateOnly(),
    fakeCreateOnly(),
    fakeCreateOnly(),
    fakeCreateOnly(),
    fakeAudit(),
  );

  const result = await handler.handle(context());
  assert.equal(result.ok, true);
  assert.equal(result.value.reused, true);
  assert.equal(result.value.id, "demo-1");
  assert.equal(projects.length, 1, "must not create a duplicate demo project");
});

test("delete-demo-project refuses to delete a real (non-demo) project", async () => {
  const real = makeProject("p-1");
  const projects = [real];
  let deleteCalled = false;
  const demoRepo = { deleteDemoProjectData: async () => { deleteCalled = true; return { ok: true, value: undefined }; } };
  const handler = new DeleteDemoProjectHandler(fakeProjectRepo(projects), demoRepo, fakeAudit());

  const result = await handler.handle(context(), "p-1");
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "FORBIDDEN");
  assert.equal(deleteCalled, false, "must never touch a real project's data");
});

test("delete-demo-project deletes and audits an isDemo project", async () => {
  const demo = makeProject("demo-1", { isDemo: true });
  const projects = [demo];
  let deleteCalled = false;
  const demoRepo = {
    deleteDemoProjectData: async (tenantId, projectId) => {
      deleteCalled = true;
      assert.equal(projectId, "demo-1");
      return { ok: true, value: undefined };
    },
  };
  const audit = fakeAudit();
  const handler = new DeleteDemoProjectHandler(fakeProjectRepo(projects), demoRepo, audit);

  const result = await handler.handle(context(), "demo-1");
  assert.equal(result.ok, true);
  assert.equal(deleteCalled, true);
  assert.equal(audit.events[0].eventType, "project.demo.deleted");
});

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

test("demo projects never count toward active or archived plan-limit usage", async () => {
  const real = makeProject("p-1");
  const demo = makeProject("p-2", { isDemo: true });
  const archivedDemo = makeProject("p-3", { isDemo: true });
  archivedDemo.archive();

  const entitlements = makeEntitlementService([real, demo, archivedDemo]);
  const usage = await entitlements.usageSnapshot({ tenantId: "tenant-a" });
  assert.equal(usage.ok, true);
  assert.equal(usage.value.activeProjects, 1, "only the real project counts as active");
  assert.equal(usage.value.archivedProjects, 0, "the archived demo project must not count as archived usage either");
});
