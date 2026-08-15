import assert from "node:assert/strict";
import test from "node:test";
import {
  Project,
  ProjectSetup,
  ReportingProfile,
  createSection,
  normalizeSection,
  TenantId,
  DomainError,
  DateRange,
  Money,
} from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");

test("ProjectSetup lifecycle transitions", () => {
  const setup = ProjectSetup.create({ id: "s1", tenantId: "tenant-a", projectId: "p1", status: "PENDING" });
  assert.equal(setup.workspaceProvisionStatus, "PENDING");
  assert.equal(setup.isWorkspaceReady(), false);

  setup.beginProvision();
  assert.equal(setup.workspaceProvisionStatus, "IN_PROGRESS");
  assert.equal(setup.provisionAttemptCount, 1);
  assert.ok(setup.lastProvisionAttemptAt);

  setup.markReady();
  assert.equal(setup.workspaceProvisionStatus, "READY");
  assert.equal(setup.isWorkspaceReady(), true);
});

test("ProjectSetup NOT_REQUIRED is workspace-ready", () => {
  const setup = ProjectSetup.create({ id: "s2", tenantId: "tenant-a", projectId: "p1", status: "NOT_REQUIRED" });
  assert.equal(setup.isWorkspaceReady(), true);
});

test("ProjectSetup marks failed with an error", () => {
  const setup = ProjectSetup.create({ id: "s3", tenantId: "tenant-a", projectId: "p1" });
  setup.markFailed("OAuth revoked");
  assert.equal(setup.workspaceProvisionStatus, "FAILED");
  assert.equal(setup.workspaceProvisionError, "OAuth revoked");
});

test("ProjectSetup acknowledgement is idempotent", () => {
  const setup = ProjectSetup.create({ id: "s4", tenantId: "tenant-a", projectId: "p1" });
  setup.acknowledge("user-1");
  setup.acknowledge("user-2");
  assert.equal(setup.acknowledgedById, "user-1");
});

test("ProjectSetup rejects invalid status and transition", () => {
  assert.throws(() => ProjectSetup.create({ id: "x", tenantId: "t", projectId: "p", status: "BOGUS" }), DomainError);
  const ready = ProjectSetup.create({ id: "x", tenantId: "t", projectId: "p", status: "READY" });
  assert.throws(() => ready.beginProvision(), DomainError);
});

test("ReportingProfile create + update bumps version and validates overrides", () => {
  const profile = ReportingProfile.create({
    id: "r1",
    tenantId: "tenant-a",
    projectId: "p1",
    language: "en",
    tone: "FORMAL",
    createdById: "user-1",
  });
  assert.equal(profile.version, 1);
  assert.equal(profile.language, "en");

  profile.update({ tone: "CONCISE", sectionOverrides: { "sec-1": { min: 100, max: 200 } }, updatedById: "user-2" });
  assert.equal(profile.version, 2);
  assert.equal(profile.tone, "CONCISE");
  assert.deepEqual(profile.sectionOverrides["sec-1"], { min: 100, max: 200 });
  assert.equal(profile.updatedById, "user-2");
});

test("ReportingProfile rejects invalid overrides", () => {
  assert.throws(
    () => ReportingProfile.create({ id: "r2", tenantId: "t", projectId: "p", sectionOverrides: { s: { min: 200, max: 100 } }, createdById: "u" }),
    DomainError,
  );
  assert.throws(
    () => ReportingProfile.create({ id: "r3", tenantId: "t", projectId: "p", sectionOverrides: { s: { max: -1 } }, createdById: "u" }),
    DomainError,
  );
  assert.throws(
    () => ReportingProfile.create({ id: "r4", tenantId: "t", projectId: "p", tone: "LOUD", createdById: "u" }),
    DomainError,
  );
});

test("Project lifecycle: activate blocks completed, restore unarchives", () => {
  const project = Project.create({
    id: "p1",
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
  assert.equal(project.status, "DRAFT");

  project.complete();
  assert.equal(project.status, "COMPLETED");
  assert.throws(() => project.activate(), DomainError);

  project.archive();
  assert.equal(project.status, "ARCHIVED");
  project.restore();
  assert.equal(project.status, "DRAFT");
});

test("Project dates and budget are editable post-create (Feature 18 must-fix)", () => {
  const project = Project.create({
    id: "p2",
    tenantId,
    props: {
      title: "Farmers",
      projectCode: "F-01",
      donorName: "FAO",
      implementingOrganization: "NGO",
      country: "Kenya",
      sector: "LIVELIHOODS",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      reportingFrequency: "ANNUAL",
      budgetAmount: 10000,
      budgetCurrency: "USD",
    },
  });
  assert.equal(project.budget.amount, 10000);

  project.updateDetails({ duration: DateRange.create(new Date("2026-02-01"), new Date("2027-01-31")) });
  assert.equal(project.duration.start.toISOString().slice(0, 10), "2026-02-01");
  project.updateDetails({ budget: Money.create(25000, "EUR") });
  assert.equal(project.budget.amount, 25000);
  assert.equal(project.budget.currency, "EUR");
});

test("Project workspace root is settable", () => {
  const project = Project.create({
    id: "p3",
    tenantId,
    props: {
      title: "WASH",
      projectCode: "W-1",
      donorName: "D",
      implementingOrganization: "I",
      country: "X",
      sector: "HEALTH",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-06-30"),
      reportingFrequency: "MONTHLY",
    },
  });
  project.setWorkspaceRoot("drive-folder-abc");
  assert.equal(project.workspaceRootId, "drive-folder-abc");
});

test("TemplateSection gets stable IDs, review status, and word limits", () => {
  const section = createSection({
    title: "Executive Summary",
    inputType: "NARRATIVE",
    required: true,
    reviewStatus: "REVIEWED",
    minWords: 100,
    maxWords: 200,
  });
  assert.ok(section.id);
  assert.equal(section.reviewStatus, "REVIEWED");
  assert.equal(section.minWords, 100);
  assert.equal(section.maxWords, 200);
});

test("TemplateSection rejects invalid word limits", () => {
  assert.throws(
    () => createSection({ title: "X", inputType: "NARRATIVE", required: true, minWords: 50, maxWords: 20 }),
    DomainError,
  );
});

test("normalizeSection backfills stable IDs for legacy sections", () => {
  const normalized = normalizeSection({ title: "Old", inputType: "TABLE", required: false }, 0);
  assert.ok(normalized.id);
  assert.equal(normalized.order, 0);
  assert.equal(normalized.reviewStatus, "DRAFT");
});
