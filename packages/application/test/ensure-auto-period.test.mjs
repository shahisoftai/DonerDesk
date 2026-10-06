import assert from "node:assert/strict";
import test from "node:test";
import { Project, ReportingPeriod, ReportingProfile, TenantId, DEFAULT_DEADLINE_OFFSET_DAYS } from "@donordesk/domain";
import { CreateReportingPeriodHandler, EnsureAutoPeriodHandler } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ctx = { tenant: { tenantId, userId: "user-1" }, requestId: "req-1" };
const noopAudit = { record: async () => {} };
const noopEvents = { publish: async () => {} };
const readyReadiness = { compute: async () => ({ ok: true, value: { ready: true, blockers: [] } }) };

// Fully in the past, so "is this period due yet" never depends on today's date.
const PROJECT_START = new Date("2020-01-01");
const PROJECT_END = new Date("2020-12-31");

function project(reportingFrequency) {
  return Project.create({
    id: "proj-1",
    tenantId,
    props: {
      title: "Test Project",
      projectCode: "T-1",
      donorName: "Donor",
      implementingOrganization: "Org",
      country: "KE",
      sector: "HEALTH",
      reportingFrequency,
      startDate: PROJECT_START,
      endDate: PROJECT_END,
    },
  });
}

function profile(overrides = {}) {
  return ReportingProfile.create({ id: "profile-1", tenantId: tenantId.toString(), projectId: "proj-1", autoPeriodCreation: true, createdById: "user-1", ...overrides });
}

function fakePeriodsRepo(initial = []) {
  const store = new Map(initial.map((p) => [p.id, p]));
  return {
    create: async (p) => { store.set(p.id, p); return { ok: true, value: p }; },
    update: async (p) => { store.set(p.id, p); return { ok: true, value: p }; },
    findById: async (id) => ({ ok: true, value: store.get(id) ?? null }),
    findByProject: async (projectId, _t, opts = {}) => ({ ok: true, value: [...store.values()].filter((p) => p.projectId === projectId && (opts.includeCancelled || !p.isCancelled)) }),
    findPreviousPeriods: async () => ({ ok: true, value: [] }),
    all: () => [...store.values()],
  };
}

function build({ reportingFrequency = "MONTHLY", profileOverrides = {}, existingPeriods = [] } = {}) {
  const periodsRepo = fakePeriodsRepo(existingPeriods);
  const projectsRepo = { findById: async () => ({ ok: true, value: project(reportingFrequency) }) };
  const profilesRepo = { findByProject: async () => ({ ok: true, value: profile(profileOverrides) }) };
  const templatesRepo = { findById: async () => ({ ok: true, value: null }) };
  const projectSetupRepo = {};
  let nextId = 0;
  const ids = { generate: () => `auto-period-${++nextId}` };
  const createPeriod = new CreateReportingPeriodHandler(ids, periodsRepo, projectsRepo, templatesRepo, projectSetupRepo, profilesRepo, readyReadiness, noopAudit, noopEvents);
  const handler = new EnsureAutoPeriodHandler(projectsRepo, profilesRepo, periodsRepo, createPeriod);
  return { handler, periodsRepo };
}

test("EnsureAutoPeriodHandler: creates the first monthly period once it is due, with a deadline from the profile offset", async () => {
  const { handler, periodsRepo } = build({ profileOverrides: { deadlineOffsetDays: 10 } });
  const r = await handler.handle(ctx, "proj-1");
  assert.ok(r.ok, r.ok ? "" : r.error.message);
  assert.equal(r.value.created, true);
  const [created] = periodsRepo.all();
  assert.equal(created.reportType, "MONTHLY");
  assert.equal(created.duration.start.toISOString().slice(0, 10), "2020-01-01");
  assert.equal(created.duration.end.toISOString().slice(0, 10), "2020-01-31");
  assert.equal(created.deadline.toISOString().slice(0, 10), "2020-02-10");
});

test("EnsureAutoPeriodHandler: with no profile offset, falls back to the documented default (never blank, never the project end date)", async () => {
  const { handler, periodsRepo } = build();
  const r = await handler.handle(ctx, "proj-1");
  assert.ok(r.ok);
  const [created] = periodsRepo.all();
  const expected = new Date("2020-01-31");
  expected.setUTCDate(expected.getUTCDate() + DEFAULT_DEADLINE_OFFSET_DAYS);
  assert.equal(created.deadline.toISOString().slice(0, 10), expected.toISOString().slice(0, 10));
  assert.notEqual(created.deadline.toISOString().slice(0, 10), "2020-12-31", "must not default to the project's own end date");
});

test("EnsureAutoPeriodHandler: auto-creation off on the profile → no-op", async () => {
  const { handler, periodsRepo } = build({ profileOverrides: { autoPeriodCreation: false } });
  const r = await handler.handle(ctx, "proj-1");
  assert.ok(r.ok);
  assert.equal(r.value.created, false);
  assert.equal(periodsRepo.all().length, 0);
});

test("EnsureAutoPeriodHandler: a reporting frequency with no safe report-type mapping (semi-annual, custom) is skipped", async () => {
  for (const frequency of ["SEMI_ANNUAL", "CUSTOM"]) {
    const { handler, periodsRepo } = build({ reportingFrequency: frequency });
    const r = await handler.handle(ctx, "proj-1");
    assert.ok(r.ok);
    assert.equal(r.value.created, false, frequency);
    assert.equal(periodsRepo.all().length, 0, frequency);
  }
});

test("EnsureAutoPeriodHandler: the project's duration already fully covered by an existing period → no-op", async () => {
  const existing = { id: "p0", projectId: "proj-1", duration: { end: PROJECT_END } };
  const { handler, periodsRepo } = build({ existingPeriods: [existing] });
  const r = await handler.handle(ctx, "proj-1");
  assert.ok(r.ok);
  assert.equal(r.value.created, false);
  assert.equal(periodsRepo.all().length, 1, "the existing period is untouched, nothing new created");
});

test("EnsureAutoPeriodHandler: at most one period is created per call (chained, not backfilled all at once)", async () => {
  const { handler, periodsRepo } = build();
  const first = await handler.handle(ctx, "proj-1");
  assert.equal(first.value.created, true);
  const second = await handler.handle(ctx, "proj-1");
  assert.equal(second.value.created, true, "the next (February) period is due too, once the profile is re-read with the January period now on record");
  assert.equal(periodsRepo.all().length, 2);
  const feb = periodsRepo.all().find((p) => p.id === "auto-period-2");
  assert.equal(feb.duration.start.toISOString().slice(0, 10), "2020-02-01");
});

test("EnsureAutoPeriodHandler: the last block of the project belongs to the closing report and is never auto-created as a regular period", async () => {
  const existing = { id: "p11", projectId: "proj-1", duration: { end: new Date("2020-11-30") } };
  const { handler, periodsRepo } = build({ existingPeriods: [existing] });
  const r = await handler.handle(ctx, "proj-1");
  assert.ok(r.ok);
  assert.equal(r.value.created, false, "December reaches the project's end: it is the closing report's period");
  assert.equal(periodsRepo.all().length, 1);
});

test("EnsureAutoPeriodHandler: a cancelled month is not created again on the next page load (browser check, 25.6)", async () => {
  const jan = ReportingPeriod.create({ id: "jan", tenantId: tenantId.toString(), projectId: "proj-1", reportType: "MONTHLY", startDate: new Date("2020-01-01"), endDate: new Date("2020-01-31"), deadline: new Date("2020-02-10") });
  jan.cancel("by mistake", new Date());
  const { handler, periodsRepo } = build({ existingPeriods: [jan] });
  const r = await handler.handle(ctx, "proj-1");
  assert.ok(r.ok);
  const created = periodsRepo.all().filter((p) => p.id !== "jan");
  assert.equal(created.length, 1);
  assert.equal(created[0].duration.start.toISOString().slice(0, 10), "2020-02-01", "the next month, not the cancelled one");
});
