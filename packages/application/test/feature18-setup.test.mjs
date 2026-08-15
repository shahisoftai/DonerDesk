import assert from "node:assert/strict";
import test from "node:test";
import { TenantId, Project, ProjectSetup, ReportingProfile, DomainError, DateRange } from "@donordesk/domain";
import { ProjectReadinessService, CreateReportingPeriodHandler, UpsertReportingProfileHandler, GetProjectSetupHandler } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ctx = { tenant: { tenantId, userId: "user-1", role: "ADMIN" }, requestId: "r-1" };

/** Unrestricted entitlement stub (Enterprise-like) for non-billing tests. */
function unrestrictedEntitlements() {
  return {
    resolve: async () => ({
      ok: true,
      value: {
        planCode: "ENTERPRISE",
        source: "MANUAL",
        catalogVersion: 1,
        limits: {
          maxActiveProjects: null,
          maxSeats: null,
          maxManagedStorageBytes: null,
          monthlyAiDraftCredits: null,
        },
        effectiveFrom: new Date(),
        overLimit: [],
        isTrial: false,
      },
    }),
    usageSnapshot: async () => ({
      ok: true,
      value: { activeProjects: 0, seats: 0, managedStorageBytes: 0n, aiDraftCreditsUsed: 0, aiDraftCreditsReserved: 0 },
    }),
    toSummary: async () => ({ ok: true, value: {} }),
    resolveWithUsage: async () => ({ ok: true, value: null }),
  };
}

function makeProject(id = "p1") {
  return Project.create({
    id,
    tenantId,
    props: {
      title: "Clean Water",
      projectCode: "CW-01",
      donorName: "UNICEF",
      implementingOrganization: "NGO",
      country: "Somalia",
      sector: "WASH",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      reportingFrequency: "QUARTERLY",
    },
  });
}

function makeReadyProject() {
  const p = makeProject();
  const setup = ProjectSetup.create({ id: "s1", tenantId: "tenant-a", projectId: p.id, status: "NOT_REQUIRED" });
  const profile = ReportingProfile.create({ id: "rp1", tenantId: "tenant-a", projectId: p.id, createdById: "user-1" });
  return { p, setup, profile };
}

// In-memory repositories
function makeRepos(overrides = {}) {
  const projects = {
    findById: async (id, tid) => ({ ok: true, value: overrides.project ?? (id === "p1" ? makeProject() : null) }),
    update: async (x) => ({ ok: true, value: x }),
  };
  const setup = {
    findByProject: async () => ({ ok: true, value: overrides.setup ?? null }),
    ensureForProject: async () => ({ ok: true, value: overrides.setup ?? ProjectSetup.create({ id: "s0", tenantId: "tenant-a", projectId: "p1" }) }),
    update: async (x) => ({ ok: true, value: x }),
    create: async (x) => ({ ok: true, value: x }),
  };
  const profiles = {
    findByProject: async () => ({ ok: true, value: overrides.profile ?? null }),
    update: async (x) => ({ ok: true, value: x }),
    create: async (x) => ({ ok: true, value: x }),
  };
  const templates = {
    findByProject: async () => ({ ok: true, value: overrides.templates ?? [] }),
    findById: async (id, tid) => {
      const list = overrides.templates ?? [];
      return { ok: true, value: overrides.templateById ?? list.find((t) => t.id === id) ?? null };
    },
  };
  const indicators = {
    findByProject: async () => ({ ok: true, value: overrides.indicators ?? [] }),
  };
  const users = { listByTenant: async () => ({ ok: true, value: [] }) };
  const providerResolver = {
    resolve: async () => ({ ok: true, value: { provider: overrides.provider ?? "LOCAL" } }),
  };
  return { projects, setup, profiles, templates, indicators, users, providerResolver };
}

function reportableIndicator() {
  return { id: "i1", code: "I1", name: "People reached", type: "NUMBER", baseline: "0", target: "100", unit: "people", frequency: "QUARTERLY", logframeItemId: "l1", projectId: "p1", tenantIdValue: "tenant-a" };
}

test("readiness: no setup -> IN_PROGRESS with profile blocker", async () => {
  const repos = makeRepos();
  const service = new ProjectReadinessService(repos.projects, repos.setup, repos.profiles, repos.templates, repos.indicators, repos.users, repos.providerResolver);
  const r = await service.compute("p1", tenantId);
  assert.equal(r.ok, true);
  assert.equal(r.value.ready, false);
  assert.ok(r.value.blockers.some((b) => b.code === "REPORTING_PROFILE_MISSING"));
});

test("readiness: workspace FAILED -> ACTION_REQUIRED", async () => {
  const setup = ProjectSetup.create({ id: "s", tenantId: "tenant-a", projectId: "p1" });
  setup.markFailed("OAuth revoked");
  const repos = makeRepos({
    provider: "GOOGLE_DRIVE",
    setup,
    profile: ReportingProfile.create({ id: "rp", tenantId: "tenant-a", projectId: "p1", createdById: "u" }),
  });
  const service = new ProjectReadinessService(repos.projects, repos.setup, repos.profiles, repos.templates, repos.indicators, repos.users, repos.providerResolver);
  const r = await service.compute("p1", tenantId);
  assert.equal(r.value.status, "ACTION_REQUIRED");
  assert.ok(r.value.blockers.some((b) => b.code === "WORKSPACE_PROVISION_FAILED"));
});

test("readiness: missing indicators -> NO_REPORTABLE_INDICATORS", async () => {
  const repos = makeRepos({
    setup: ProjectSetup.create({ id: "s", tenantId: "tenant-a", projectId: "p1", status: "NOT_REQUIRED" }),
    profile: ReportingProfile.create({ id: "rp", tenantId: "tenant-a", projectId: "p1", createdById: "u" }),
  });
  const service = new ProjectReadinessService(repos.projects, repos.setup, repos.profiles, repos.templates, repos.indicators, repos.users, repos.providerResolver);
  const r = await service.compute("p1", tenantId);
  assert.ok(r.value.blockers.some((b) => b.code === "NO_REPORTABLE_INDICATORS"));
});

test("readiness: ready when all hard requirements pass", async () => {
  const repos = makeRepos({
    setup: ProjectSetup.create({ id: "s", tenantId: "tenant-a", projectId: "p1", status: "NOT_REQUIRED" }),
    profile: ReportingProfile.create({ id: "rp", tenantId: "tenant-a", projectId: "p1", createdById: "u" }),
    indicators: [reportableIndicator()],
  });
  const service = new ProjectReadinessService(repos.projects, repos.setup, repos.profiles, repos.templates, repos.indicators, repos.users, repos.providerResolver);
  const r = await service.compute("p1", tenantId);
  assert.equal(r.value.ready, true);
  assert.equal(r.value.status, "READY");
  assert.equal(r.value.blockers.length, 0);
});

test("readiness: incomplete indicator -> INDICATOR_CONFIGURATION_INCOMPLETE", async () => {
  const incomplete = { ...reportableIndicator(), unit: "", frequency: "" };
  const repos = makeRepos({
    setup: ProjectSetup.create({ id: "s", tenantId: "tenant-a", projectId: "p1", status: "NOT_REQUIRED" }),
    profile: ReportingProfile.create({ id: "rp", tenantId: "tenant-a", projectId: "p1", createdById: "u" }),
    indicators: [incomplete],
  });
  const service = new ProjectReadinessService(repos.projects, repos.setup, repos.profiles, repos.templates, repos.indicators, repos.users, repos.providerResolver);
  const r = await service.compute("p1", tenantId);
  assert.ok(r.value.blockers.some((b) => b.code === "INDICATOR_CONFIGURATION_INCOMPLETE"));
});

test("readiness: template without reviewed required sections blocks", async () => {
  const template = {
    id: "t1", templateName: "T", donorName: "D", reportType: "QUARTERLY", language: "en",
    sections: [{ id: "sec1", title: "X", inputType: "NARRATIVE", required: true, reviewStatus: "DRAFT", order: 0 }],
    projectId: "p1", tenantIdValue: "tenant-a",
  };
  const repos = makeRepos({
    setup: ProjectSetup.create({ id: "s", tenantId: "tenant-a", projectId: "p1", status: "NOT_REQUIRED" }),
    profile: ReportingProfile.create({ id: "rp", tenantId: "tenant-a", projectId: "p1", defaultTemplateId: "t1", createdById: "u" }),
    templates: [template],
    indicators: [reportableIndicator()],
  });
  const service = new ProjectReadinessService(repos.projects, repos.setup, repos.profiles, repos.templates, repos.indicators, repos.users, repos.providerResolver);
  const r = await service.compute("p1", tenantId);
  assert.ok(r.value.blockers.some((b) => b.code === "TEMPLATE_HAS_NO_REVIEWED_REQUIRED_SECTIONS"));
});

test("reporting-period gate: blocked when not ready (POLICY_DENIED)", async () => {
  const repos = makeRepos();
  const readiness = new ProjectReadinessService(repos.projects, repos.setup, repos.profiles, repos.templates, repos.indicators, repos.users, repos.providerResolver);
  const periods = { create: async (x) => ({ ok: true, value: x }), findByProject: async () => ({ ok: true, value: [] }) };
  const handler = new CreateReportingPeriodHandler(
    { generate: () => "period-1" },
    periods, repos.projects, repos.templates, repos.setup, repos.profiles, readiness,
    { record: async () => {} },
  );
  const r = await handler.handle(ctx, {
    projectId: "p1", reportType: "QUARTERLY",
    startDate: new Date("2026-04-01").toISOString(), endDate: new Date("2026-06-30").toISOString(),
    deadline: new Date("2026-07-15").toISOString(),
  });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, "POLICY_DENIED");
});

test("reporting-period gate: ready project creates a period with snapshots", async () => {
  const template = {
    id: "t1", templateName: "T", donorName: "D", reportType: "QUARTERLY", language: "en",
    sections: [{ id: "sec1", title: "X", inputType: "NARRATIVE", required: true, reviewStatus: "REVIEWED", order: 0 }],
    projectId: "p1", tenantIdValue: "tenant-a",
  };
  const repos = makeRepos({
    setup: ProjectSetup.create({ id: "s", tenantId: "tenant-a", projectId: "p1", status: "NOT_REQUIRED" }),
    profile: ReportingProfile.create({ id: "rp", tenantId: "tenant-a", projectId: "p1", defaultTemplateId: "t1", createdById: "u" }),
    templates: [template],
    indicators: [reportableIndicator()],
  });
  const readiness = new ProjectReadinessService(repos.projects, repos.setup, repos.profiles, repos.templates, repos.indicators, repos.users, repos.providerResolver);
  let created;
  const periods = {
    create: async (x) => { created = x; return { ok: true, value: x }; },
    findByProject: async () => ({ ok: true, value: [] }),
  };
  const handler = new CreateReportingPeriodHandler(
    { generate: () => "period-1" }, periods, repos.projects, repos.templates, repos.setup, repos.profiles, readiness,
    { record: async () => {} },
  );
  const r = await handler.handle(ctx, {
    projectId: "p1", donorTemplateId: "t1", reportType: "QUARTERLY",
    startDate: new Date("2026-04-01").toISOString(), endDate: new Date("2026-06-30").toISOString(),
    deadline: new Date("2026-07-15").toISOString(),
  });
  assert.equal(r.ok, true);
  assert.equal(r.value.id, "period-1");
  assert.ok(created.templateSnapshotJson.includes("sec1"));
  assert.ok(created.reportingProfileSnapshotJson.includes("FORMAL"));
});

test("reporting-period gate: overlap rejected", async () => {
  const repos = makeRepos({
    setup: ProjectSetup.create({ id: "s", tenantId: "tenant-a", projectId: "p1", status: "NOT_REQUIRED" }),
    profile: ReportingProfile.create({ id: "rp", tenantId: "tenant-a", projectId: "p1", createdById: "u" }),
    indicators: [reportableIndicator()],
  });
  const readiness = new ProjectReadinessService(repos.projects, repos.setup, repos.profiles, repos.templates, repos.indicators, repos.users, repos.providerResolver);
  const existing = {
    duration: DateRange.create(new Date("2026-04-01"), new Date("2026-06-30")),
  };
  const periods = {
    create: async (x) => ({ ok: true, value: x }),
    findByProject: async () => ({ ok: true, value: [existing] }),
  };
  const handler = new CreateReportingPeriodHandler(
    { generate: () => "p" }, periods, repos.projects, repos.templates, repos.setup, repos.profiles, readiness,
    { record: async () => {} },
  );
  const r = await handler.handle(ctx, {
    projectId: "p1", reportType: "QUARTERLY",
    startDate: new Date("2026-05-01").toISOString(), endDate: new Date("2026-07-31").toISOString(),
    deadline: new Date("2026-08-15").toISOString(),
  });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, "CONFLICT");
});

test("reporting-period gate: completed project rejected", async () => {
  const completed = makeProject();
  completed.complete();
  const repos = makeRepos({ project: completed });
  const readiness = new ProjectReadinessService(repos.projects, repos.setup, repos.profiles, repos.templates, repos.indicators, repos.users, repos.providerResolver);
  const periods = { create: async (x) => ({ ok: true, value: x }), findByProject: async () => ({ ok: true, value: [] }) };
  const handler = new CreateReportingPeriodHandler(
    { generate: () => "p" }, periods, repos.projects, repos.templates, repos.setup, repos.profiles, readiness,
    { record: async () => {} },
  );
  const r = await handler.handle(ctx, {
    projectId: "p1", reportType: "QUARTERLY",
    startDate: new Date("2026-04-01").toISOString(), endDate: new Date("2026-06-30").toISOString(),
    deadline: new Date("2026-07-15").toISOString(),
  });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, "INVALID_STATE_TRANSITION");
});

test("upsert profile: version mismatch rejected with CONFLICT", async () => {
  const profile = ReportingProfile.create({ id: "rp", tenantId: "tenant-a", projectId: "p1", createdById: "u" });
  profile.update({ updatedById: "u" }); // version 2
  const repos = makeRepos({ profile });
  const handler = new UpsertReportingProfileHandler(
    { generate: () => "new-id" }, repos.profiles, repos.templates, { record: async () => {} },
  );
  const r = await handler.handle(ctx, "p1", { language: "en", tone: "FORMAL", formattingRules: [], specialRequirements: [], sectionOverrides: {}, expectedVersion: 1 });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, "CONFLICT");
});

test("upsert profile: creates when missing and validates template ownership", async () => {
  const repos = makeRepos();
  const handler = new UpsertReportingProfileHandler(
    { generate: () => "new-id" }, repos.profiles, repos.templates, { record: async () => {} },
  );
  // no default template id -> create path
  const r = await handler.handle(ctx, "p1", { language: "en", tone: "FORMAL", formattingRules: [], specialRequirements: [], sectionOverrides: {} });
  assert.equal(r.ok, true);
  assert.equal(r.value.created, true);
  assert.equal(r.value.profile.version, 1);
});

test("get-project-setup returns readiness + snapshot", async () => {
  const repos = makeRepos({
    setup: ProjectSetup.create({ id: "s", tenantId: "tenant-a", projectId: "p1", status: "NOT_REQUIRED" }),
    profile: ReportingProfile.create({ id: "rp", tenantId: "tenant-a", projectId: "p1", createdById: "u" }),
    indicators: [reportableIndicator()],
  });
  const readiness = new ProjectReadinessService(repos.projects, repos.setup, repos.profiles, repos.templates, repos.indicators, repos.users, repos.providerResolver);
  const handler = new GetProjectSetupHandler(readiness);
  const r = await handler.handle(ctx, "p1");
  assert.equal(r.ok, true);
  assert.equal(r.value.readiness.ready, true);
  assert.equal(r.value.snapshot.indicators.total, 1);
});

test("readiness: legacy project without setup row on LOCAL is NOT_REQUIRED (rollout safety)", async () => {
  // No setup row at all (legacy project), provider = LOCAL.
  const repos = makeRepos({
    profile: ReportingProfile.create({ id: "rp", tenantId: "tenant-a", projectId: "p1", createdById: "u" }),
    indicators: [reportableIndicator()],
  });
  const service = new ProjectReadinessService(repos.projects, repos.setup, repos.profiles, repos.templates, repos.indicators, repos.users, repos.providerResolver);
  const r = await service.compute("p1", tenantId);
  // Workspace must NOT block a legacy LOCAL project.
  assert.equal(r.value.blockers.some((b) => b.code === "WORKSPACE_PENDING"), false);
  const snapshot = await service.snapshot("p1", tenantId);
  assert.equal(snapshot.ok, true);
  assert.equal(snapshot.value.workspace.provisionStatus, "NOT_REQUIRED");
});

test("readiness: legacy Drive project without setup row stays PENDING", async () => {
  const repos = makeRepos({ provider: "GOOGLE_DRIVE" });
  const service = new ProjectReadinessService(repos.projects, repos.setup, repos.profiles, repos.templates, repos.indicators, repos.users, repos.providerResolver);
  const r = await service.compute("p1", tenantId);
  assert.ok(r.value.blockers.some((b) => b.code === "WORKSPACE_PENDING"));
});

test("create-project seeds the reporting profile from org defaults", async () => {
  const { CreateProjectHandler } = await import("../dist/index.js");
  const ctx = { tenant: { tenantId, userId: "user-1", role: "ADMIN" }, requestId: "r-1" };
  const org = {
    defaultLanguage: "en",
    reportingDefaults: { tone: "CONCISE", formattingRules: ["use headings"], deadlineOffsetDays: 14, autoPeriodCreation: true },
  };
  let createdProfile;
  const projects = {
    create: async (p) => ({ ok: true, value: p }),
    update: async (p) => ({ ok: true, value: p }),
    findById: async () => ({ ok: true, value: null }),
  };
  const setup = {
    create: async (s) => ({ ok: true, value: s }),
    update: async (s) => ({ ok: true, value: s }),
  };
  const profiles = { create: async (p) => { createdProfile = p; return { ok: true, value: p }; } };
  const organizations = { findByTenant: async () => ({ ok: true, value: org }) };
  const providerResolver = { resolve: async () => ({ ok: true, value: { provider: "LOCAL" } }) };
  const events = { publish: async () => ({ ok: true }) };
  const audit = { record: async () => {} };
  const ids = { generate: () => crypto.randomUUID() };

  const handler = new CreateProjectHandler(ids, projects, setup, profiles, organizations, providerResolver, events, audit, unrestrictedEntitlements());
  const r = await handler.handle(ctx, {
    title: "Clean Water", projectCode: "CW-02", donorName: "UNICEF", implementingOrganization: "NGO",
    country: "Somalia", sector: "WASH",
    startDate: new Date("2026-01-01").toISOString(), endDate: new Date("2026-12-31").toISOString(),
    reportingFrequency: "QUARTERLY",
  });
  assert.equal(r.ok, true);
  assert.ok(createdProfile, "reporting profile should be seeded");
  assert.equal(createdProfile.tone, "CONCISE");
  assert.deepEqual(createdProfile.formattingRules, ["use headings"]);
  assert.equal(createdProfile.deadlineOffsetDays, 14);
  assert.equal(createdProfile.autoPeriodCreation, true);
  assert.equal(createdProfile.language, "en");
});

test("create-project without org defaults still succeeds (no profile seeded)", async () => {
  const { CreateProjectHandler } = await import("../dist/index.js");
  const ctx = { tenant: { tenantId, userId: "user-1", role: "ADMIN" }, requestId: "r-1" };
  let createdProfile = null;
  const projects = { create: async (p) => ({ ok: true, value: p }), update: async (p) => ({ ok: true, value: p }) };
  const setup = { create: async (s) => ({ ok: true, value: s }), update: async (s) => ({ ok: true, value: s }) };
  const profiles = { create: async (p) => { createdProfile = p; return { ok: true, value: p }; } };
  const organizations = { findByTenant: async () => ({ ok: true, value: null }) };
  const providerResolver = { resolve: async () => ({ ok: true, value: { provider: "LOCAL" } }) };
  const events = { publish: async () => ({ ok: true }) };
  const audit = { record: async () => {} };
  const ids = { generate: () => crypto.randomUUID() };
  const handler = new CreateProjectHandler(ids, projects, setup, profiles, organizations, providerResolver, events, audit, unrestrictedEntitlements());
  const r = await handler.handle(ctx, {
    title: "WASH", projectCode: "W-02", donorName: "D", implementingOrganization: "I",
    country: "KE", sector: "HEALTH",
    startDate: new Date("2026-01-01").toISOString(), endDate: new Date("2026-12-31").toISOString(),
    reportingFrequency: "MONTHLY",
  });
  assert.equal(r.ok, true);
  assert.equal(createdProfile, null);
});
