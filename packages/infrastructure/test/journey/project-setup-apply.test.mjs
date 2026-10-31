// Phase 36.3 on the real stack: a reviewed proposal is previewed and applied through the container's real handlers and a
// real Postgres, then applied again from a clean run history to prove nothing is created twice.
// Opt-in: UOW_VERIFY_DATABASE_URL=postgresql://... (a migrated scratch database with rls.sql applied)
import assert from "node:assert/strict";
import test from "node:test";
import { TenantId } from "@donordesk/domain";

const url = process.env.UOW_VERIFY_DATABASE_URL;
const skip = url ? false : "set UOW_VERIFY_DATABASE_URL to a migrated scratch database";
process.env.JWT_SECRET ??= "test-secret-that-is-at-least-32-characters";
if (url) {
  process.env.DATABASE_URL = url;
  process.env.DATABASE_ADMIN_URL = url;
}
const must = (r, what) => { assert.equal(r.ok, true, `${what}: ${r.ok ? "" : r.error.message}`); return r.value; };
const size = (v) => (Array.isArray(v) ? v.length : (v.items ?? v.places ?? v.rows ?? []).length);

const A = (value, quote = "q") => ({ value, sourceQuote: quote, sourceRef: null, confidence: "HIGH", status: "ACCEPTED" });
const N = () => ({ value: null, sourceQuote: null, sourceRef: null, confidence: "LOW", status: "PROPOSED" });

function proposal() {
  return {
    facts: { name: A("Blue Water Gulu"), code: N(), donor: A("European Union"), countries: A(["Uganda"]), sectors: N(), startDate: A("2027-03-01"), endDate: A("2029-02-28"), currency: A("EUR"), summary: N() },
    logframe: [
      A({ level: "GOAL", code: "1", title: "Improved household health", description: null, parentCode: null }),
      A({ level: "OUTCOME", code: "1.1", title: "Households use safe water", description: null, parentCode: "1" }),
      A({ level: "OUTPUT", code: "1.1.1", title: "Boreholes rehabilitated", description: null, parentCode: "1.1" }),
    ],
    indicators: [
      A({ code: "1.1.a", title: "People with safe water", logframeCode: "1.1.1", type: "NUMBER", unit: "people", baseline: "0", target: "12000", targetSchedule: null, frequency: "Quarterly", direction: null, disaggregation: null, meansOfVerification: null }),
      A({ code: null, title: "Boreholes functional", logframeCode: "1.1.1", type: null, unit: null, baseline: "0", target: "40", targetSchedule: null, frequency: "Quarterly", direction: null, disaggregation: null, meansOfVerification: null }),
    ],
    periods: [A({ type: "QUARTERLY", start: null, end: null })],
    plan: [A({ title: "Borehole rehabilitation", logframeCode: "1.1.1", start: "2027-04-01", end: "2027-09-30", location: "Gulu District", lead: null })],
    places: [
      A({ name: "Uganda", adminLevel: 0, parentName: null, latitude: null, longitude: null }),
      A({ name: "Gulu District", adminLevel: 2, parentName: "Uganda", latitude: null, longitude: null }),
    ],
    funding: [A({ sourceName: "European Union", amount: "1,250,000", currency: "EUR" })],
    budget: [A({ category: "Personnel", amount: "400,000", currency: "EUR", logframeCode: null })],
    risks: [A({ kind: "RISK", title: "Flooding delays works", seriousness: "high", mitigation: "Work in the dry season" })],
  };
}

test("journey: preview, apply, refuse a second apply, and re-apply from a clean run history without duplicates", { skip }, async (t) => {
  const { createContainer } = await import("../../dist/container.js");
  const c = createContainer({ useAdminConnection: true });
  t.after(async () => { await c.settleBackgroundWork(); await c.prisma.$disconnect(); });
  const h = c.handlers;
  const stamp = Date.now();

  const signedUp = must(await h.signUp.handle({
    name: "Setup Admin", email: `setup-${stamp}@example.org`, password: "Correct-Horse-9-Battery",
    organization: { name: `Setup Org ${stamp}`, organizationType: "LOCAL_NGO", country: "Uganda", primarySector: "WASH" },
  }), "sign up");
  const tenantId = TenantId.create(signedUp.tenantId);
  const ctx = { tenant: { tenantId, userId: signedUp.userId, role: "ADMIN" }, requestId: "setup-journey" };

  const id = `psp-${stamp}`;
  await c.prisma.projectSetupProposal.create({
    data: {
      id, tenantId: signedUp.tenantId, createdById: signedUp.userId, status: "READY", sourceName: "blue-water.docx", sourceStorageKey: "none",
      sourceHash: "h", sourceLength: 10, proposalJson: JSON.stringify(proposal()), problemsJson: "[]", expiresAt: new Date(Date.now() + 864e5),
    },
  });

  // Preview writes nothing and says what is missing.
  const areas = Object.fromEntries(["FACTS", "LOGFRAME", "INDICATORS", "PERIODS", "PLAN", "PLACES", "FUNDING_BUDGET", "RISKS"].map((a) => [a, true]));
  const preview = must(await h.previewSetupApply.handle(ctx, id, areas), "preview");
  assert.equal(preview.blocking.length, 0, JSON.stringify(preview.blocking));
  assert.ok(preview.missing.includes("implementingOrganization"));
  assert.equal(await c.prisma.project.count({ where: { tenantId: signedUp.tenantId, title: "Blue Water Gulu" } }), 0, "a preview creates no project");

  const form = {
    title: "Blue Water Gulu", projectCode: `BWG-${stamp}`, donorName: "European Union", implementingOrganization: "Setup Org", country: "Uganda", sector: "WASH",
    startDate: "2027-03-01T00:00:00.000Z", endDate: "2029-02-28T00:00:00.000Z", reportingFrequency: "QUARTERLY",
  };
  const applied = must(await h.applySetupProposal.handle(ctx, id, { project: form, areas }), "apply");
  assert.equal(applied.status, "APPLIED", JSON.stringify(applied.areas));
  const projectId = applied.projectId;

  const counts = async () => ({
    logframe: size(must(await h.listLogframe.handle(ctx, projectId), "logframe")),
    indicators: size(must(await h.listIndicators.handle(ctx, projectId), "indicators")),
    plan: size(must(await h.listWorkPlan.handle(ctx, projectId), "plan")),
    risks: size(must(await h.listRisks.handle(ctx, projectId), "risks")),
    periods: size(must(await h.listReportingPeriods.handle(ctx, projectId), "periods")),
    funding: await c.prisma.projectFunding.count({ where: { projectId } }),
    projects: await c.prisma.project.count({ where: { tenantId: signedUp.tenantId, title: "Blue Water Gulu" } }),
  });
  const first = await counts();
  assert.equal(first.projects, 1);
  assert.equal(first.logframe, 3);
  assert.equal(first.indicators, 2, "an indicator without a code got a generated one and was still created");
  assert.equal(first.plan, 1);
  assert.equal(first.risks, 1);
  assert.equal(first.funding, 1);
  assert.ok(first.periods >= 6, `quarterly periods across two years, got ${first.periods}`);

  // An applied proposal is not applied again.
  const refused = await h.applySetupProposal.handle(ctx, id, { project: form, areas });
  assert.equal(refused.ok, false);

  // Resume from a clean run history: the project is not created again and no area duplicates what is already there.
  await c.prisma.projectSetupRun.deleteMany({ where: { proposalId: id } });
  await c.prisma.projectSetupProposal.update({ where: { id }, data: { status: "PARTIAL" } });
  const again = must(await h.applySetupProposal.handle(ctx, id, { project: form, areas }), "re-apply");
  assert.equal(again.projectId, projectId);
  assert.deepEqual(await counts(), first, "applying again created nothing twice");
});
