import assert from "node:assert/strict";
import test from "node:test";
import {
  ABACFieldPolicyEngine,
  OrganizationBranding,
  ProjectRiskTrend,
  MultiRegionConflictResolver,
} from "../dist/index.js";

const resource = {
  resourceType: "Project",
  resourceId: "project-1",
  ownerTenantId: "tenant-1",
  ownerProjectId: "project-1",
};

test("ABAC hides financial fields from non-finance roles and enforces project scope", () => {
  const fieldOfficer = {
    userId: "user-1", tenantId: "tenant-1", role: "FIELD_OFFICER", assignedProjectIds: ["project-1"],
  };
  const grantsOfficer = { ...fieldOfficer, role: "GRANTS_OFFICER" };
  assert.equal(ABACFieldPolicyEngine.canAccessField(fieldOfficer, resource, "budgetAmount"), "none");
  assert.equal(ABACFieldPolicyEngine.canAccessField(grantsOfficer, resource, "budgetAmount"), "read");
  assert.equal(ABACFieldPolicyEngine.canAccessField(
    { ...fieldOfficer, assignedProjectIds: [] }, resource, "title",
  ), "none");
  assert.deepEqual(ABACFieldPolicyEngine.applyFieldMask(
    fieldOfficer,
    resource,
    { title: "Safe", budgetAmount: 500 },
    { title: "read", budgetAmount: "none" },
  ), { title: "Safe" });
});

test("vector clock comparison distinguishes equal and concurrent updates", () => {
  assert.equal(MultiRegionConflictResolver.vectorClockCompare(
    [{ region: "eu", counter: 2, timestamp: 10 }],
    [{ region: "eu", counter: 2, timestamp: 20 }],
  ), "equal");
  assert.equal(MultiRegionConflictResolver.vectorClockCompare(
    [{ region: "eu", counter: 2, timestamp: 10 }, { region: "us", counter: 1, timestamp: 10 }],
    [{ region: "eu", counter: 1, timestamp: 20 }, { region: "us", counter: 2, timestamp: 20 }],
  ), "concurrent");
});

test("risk scoring reaches the documented 100-point scale", () => {
  const trend = ProjectRiskTrend.create({
    id: "risk-1", tenantId: "tenant-1", projectId: "project-1",
    periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-02-01"),
  });
  trend.updateMetrics({
    missingEvidenceCount: 10,
    deadlineSlipsCount: 5,
    overdueChecklistItemsCount: 5,
    contributingFactors: [
      { type: "budget_variance", weight: 100, description: "Variance", affectedIndicatorIds: [], severity: "HIGH" },
      { type: "staffing_gap", weight: 100, description: "Vacancy", affectedIndicatorIds: [], severity: "HIGH" },
    ],
  });
  assert.equal(trend.riskScore, 100);
  assert.equal(trend.riskLevel, "CRITICAL");
  assert.throws(() => trend.updateMetrics({ missingEvidenceCount: -1 }));
});

test("branding rejects values that could inject CSS or mail headers", () => {
  const branding = OrganizationBranding.create({
    id: "brand-1", tenantId: "tenant-1", organizationId: "org-1",
  });
  assert.throws(() => branding.setBranding({ brandColorPrimary: "red;display:none" }));
  assert.throws(() => branding.setBranding({ logoUrl: "http://127.0.0.1/logo" }));
  assert.throws(() => branding.setEmailSender("NGO\r\nBcc: attacker@example.org", "sender@example.org"));
});
