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
        catalogVersion: 2,
        limits: {
          maxActiveProjects: null,
          maxSeats: null,
          maxManagedStorageBytes: null,
          monthlyAiDraftCredits: null,
          viewerSeats: null,
          aiCreditTopUp: true,
          byoLlmEnabled: true,
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
    { publish: async () => {} },
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
    { publish: async () => {} },
  );
  const r = await handler.handle(ctx, {
    projectId: "p1", reportType: "QUARTERLY",
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
    reportType: "QUARTERLY",
    duration: DateRange.create(new Date("2026-04-01"), new Date("2026-06-30")),
  };
  const periods = {
    create: async (x) => ({ ok: true, value: x }),
    findByProject: async () => ({ ok: true, value: [existing] }),
  };
  const handler = new CreateReportingPeriodHandler(
    { generate: () => "p" }, periods, repos.projects, repos.templates, repos.setup, repos.profiles, readiness,
    { record: async () => {} },
    { publish: async () => {} },
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
    { publish: async () => {} },
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

test("reporting-period gate: ad-hoc reports need a scope and may sit inside a cadence period", async () => {
  const repos = makeRepos({
    setup: ProjectSetup.create({ id: "s", tenantId: "tenant-a", projectId: "p1", status: "NOT_REQUIRED" }),
    profile: ReportingProfile.create({ id: "rp", tenantId: "tenant-a", projectId: "p1", createdById: "u" }),
    indicators: [reportableIndicator()],
  });
  const readiness = new ProjectReadinessService(repos.projects, repos.setup, repos.profiles, repos.templates, repos.indicators, repos.users, repos.providerResolver);
  const existing = { reportType: "QUARTERLY", duration: DateRange.create(new Date("2026-04-01"), new Date("2026-06-30")) };
  let created;
  const periods = {
    create: async (x) => { created = x; return { ok: true, value: x }; },
    findByProject: async () => ({ ok: true, value: [existing] }),
  };
  const activities = { findByProject: async () => ({ ok: true, value: [{ id: "act1" }] }) };
  const handler = new CreateReportingPeriodHandler(
    { generate: () => "p" }, periods, repos.projects, repos.templates, repos.setup, repos.profiles, readiness,
    { record: async () => {} }, { publish: async () => {} }, activities,
  );
  const base = {
    projectId: "p1", reportType: "ACTIVITY",
    startDate: new Date("2026-05-01").toISOString(), endDate: new Date("2026-05-31").toISOString(),
    deadline: new Date("2026-06-15").toISOString(),
  };
  const noScope = await handler.handle(ctx, base);
  assert.equal(noScope.ok, false);
  const unknown = await handler.handle(ctx, { ...base, scope: { activityIds: ["nope"] } });
  assert.equal(unknown.ok, false);
  const ok = await handler.handle(ctx, { ...base, scope: { activityIds: ["act1"] } });
  assert.equal(ok.ok, true);
  assert.deepEqual(created.scope, { activityIds: ["act1"] });
});

function adHocHandler(extra = {}) {
  const repos = makeRepos({
    setup: ProjectSetup.create({ id: "s", tenantId: "tenant-a", projectId: "p1", status: "NOT_REQUIRED" }),
    profile: ReportingProfile.create({ id: "rp", tenantId: "tenant-a", projectId: "p1", createdById: "u" }),
    indicators: [reportableIndicator()],
    ...extra.repos,
  });
  const readiness = new ProjectReadinessService(repos.projects, repos.setup, repos.profiles, repos.templates, repos.indicators, repos.users, repos.providerResolver);
  const state = { created: null };
  const periods = {
    create: async (x) => { state.created = x; return { ok: true, value: x }; },
    findByProject: async () => ({ ok: true, value: extra.existing ?? [] }),
  };
  const handler = new CreateReportingPeriodHandler(
    { generate: () => "p" }, periods, repos.projects, repos.templates, repos.setup, repos.profiles, readiness,
    { record: async () => {} }, { publish: async () => {} }, { findByProject: async () => ({ ok: true, value: [] }) },
  );
  return { handler, state };
}

test("situation reports are numbered as a series per event and remember the previous one", async () => {
  const prev = {
    id: "prev1", reportType: "SITUATION",
    duration: DateRange.create(new Date("2026-05-01"), new Date("2026-05-03")),
    scope: { eventName: "Flood in Sindh", situationDate: "2026-05-03" },
  };
  const other = {
    id: "other", reportType: "SITUATION",
    duration: DateRange.create(new Date("2026-05-10"), new Date("2026-05-11")),
    scope: { eventName: "Earthquake" },
  };
  const { handler, state } = adHocHandler({ existing: [prev, other] });
  const r = await handler.handle(ctx, {
    projectId: "p1", reportType: "SITUATION",
    startDate: new Date("2026-05-04").toISOString(), endDate: new Date("2026-05-06").toISOString(),
    deadline: new Date("2026-05-09").toISOString(),
    scope: { eventName: " flood in sindh ", situationDate: "2026-05-06", sequence: 99 },
  });
  assert.equal(r.ok, true);
  assert.equal(state.created.scope.sequence, 2, "client-supplied sequence is ignored");
  assert.equal(state.created.scope.previousPeriodId, "prev1");
  assert.equal(state.created.scope.previousSituationDate, "2026-05-03");
});

test("a full-report template cannot be attached to an activity or situation report", async () => {
  const quarterly = { id: "t1", projectId: "p1", reportType: "QUARTERLY", templateName: "QPR", sections: [{ id: "s1", required: true, reviewStatus: "REVIEWED" }], status: "REVIEWED", isReviewed: true };
  const { handler, state } = adHocHandler({ repos: { templates: [quarterly] } });
  const base = {
    projectId: "p1", reportType: "SITUATION", donorTemplateId: "t1",
    startDate: new Date("2026-05-04").toISOString(), endDate: new Date("2026-05-06").toISOString(),
    deadline: new Date("2026-05-09").toISOString(),
    scope: { eventName: "Flood", situationDate: "2026-05-06" },
  };
  const rejected = await handler.handle(ctx, base);
  assert.equal(rejected.ok, false);
  const none = await handler.handle(ctx, { ...base, donorTemplateId: undefined });
  assert.equal(none.ok, true);
  assert.equal(state.created.donorTemplateId, undefined);
});
