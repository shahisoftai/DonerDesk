// Phase 38.9 on the real stack: a finished wizard draft is signed off and launched through the container's real handlers and a
// real Postgres. The project and its parts are made, the wizard's own steps run, a person who had no account is remembered,
// and when they join by an ordinary invitation they get their place on the project and what they own. A second launch is refused.
// Opt-in: UOW_VERIFY_DATABASE_URL=postgresql://... (a migrated scratch database)
import assert from "node:assert/strict";
import test from "node:test";
import { TenantId, emptyExtras, planKeyOf } from "@donordesk/domain";

const url = process.env.UOW_VERIFY_DATABASE_URL;
const skip = url ? false : "set UOW_VERIFY_DATABASE_URL to a migrated scratch database";
process.env.JWT_SECRET ??= "test-secret-that-is-at-least-32-characters";
if (url) {
  process.env.DATABASE_URL = url;
  process.env.DATABASE_ADMIN_URL = url;
}
const must = (r, what) => { assert.equal(r.ok, true, `${what}: ${r.ok ? "" : r.error.message}`); return r.value; };
const item = (value) => ({ value, sourceQuote: null, sourceRef: null, confidence: "HIGH", status: "EDITED" });
const person = (key, name, role, email, invite = "LATER") => ({ key, name, email, role, external: false, invite });

test("journey: a finished draft is signed off and launched; a person who joins later gets their place and their indicator", { skip }, async (t) => {
  const { createContainer } = await import("../../dist/container.js");
  const c = createContainer({ useAdminConnection: true });
  t.after(async () => { await c.settleBackgroundWork(); await c.prisma.$disconnect(); });
  const h = c.handlers;
  const stamp = Date.now();
  const adminEmail = `launch-${stamp}@example.org`;
  const pmEmail = `pm-${stamp}@example.org`;
  const foEmail = `fo-${stamp}@example.org`;

  const signedUp = must(await h.signUp.handle({
    name: "Launch Admin", email: adminEmail, password: "Correct-Horse-9-Battery",
    organization: { name: `Launch Org ${stamp}`, organizationType: "LOCAL_NGO", country: "Uganda", primarySector: "WASH" },
  }), "sign up");
  // The organisation needs room for the people the setup invites (a starter plan has a seat limit of its own).
  await c.prisma.entitlementGrant.create({ data: { id: `eg-${stamp}`, tenantId: signedUp.tenantId, planCode: "ENTERPRISE", source: "MANUAL", effectiveFrom: new Date(Date.now() - 1000), reason: "launch journey" } });
  const tenantId = TenantId.create(signedUp.tenantId);
  const ctx = { tenant: { tenantId, userId: signedUp.userId, role: "ADMIN" }, requestId: "launch-journey" };

  // The draft a person would have built on the ten slides.
  const proposal = {
    facts: {
      name: item("Blue Water Launch"), code: item(`BWL-${stamp}`), donor: item(null), countries: item(["Uganda"]), sectors: item(["WASH"]),
      startDate: item("2027-03-01"), endDate: item("2028-02-29"), currency: item("EUR"), summary: item("Safe water for families."),
    },
    logframe: [
      item({ level: "GOAL", code: "G1", title: "Healthy households", description: null, parentCode: null, codeSource: "DOCUMENT" }),
      item({ level: "OUTCOME", code: "OC1", title: "Households use safe water", description: null, parentCode: "G1", codeSource: "DOCUMENT" }),
      item({ level: "OUTPUT", code: "OP1", title: "Boreholes rehabilitated", description: null, parentCode: "OC1", codeSource: "DOCUMENT" }),
      item({ level: "ACTIVITY", code: "A1", title: "Rehabilitate boreholes", description: null, parentCode: "OP1", codeSource: "DOCUMENT" }),
    ],
    indicators: [
      item({ code: "I1", title: "Boreholes working", logframeCode: "OP1", type: "NUMBER", unit: "boreholes", baseline: "0", target: "40", targetSchedule: null, frequency: "Quarterly", direction: null, disaggregation: null, meansOfVerification: null }),
      item({ code: "I2", title: "People with access to safe drinking water", logframeCode: "OP1", type: "NUMBER", unit: "people", baseline: "0", target: "12000", targetSchedule: null, frequency: "Quarterly", direction: null, disaggregation: null, meansOfVerification: null }),
    ],
    periods: [], places: [
      item({ name: "Uganda", adminLevel: 0, parentName: null, latitude: null, longitude: null }),
      item({ name: "Gulu District", adminLevel: 2, parentName: "Uganda", latitude: null, longitude: null }),
    ],
    plan: [item({ title: "Rehabilitate boreholes", logframeCode: "A1", start: "2027-04-01", end: "2027-09-30", location: null, lead: null, planCode: "1.1" })],
    funding: [item({ sourceName: "European Union", amount: "400000", currency: "EUR" })],
    budget: [item({ category: "Boreholes", amount: "400000", currency: "EUR", logframeCode: null, kind: "LINE", key: "b1" })],
    risks: [item({ kind: "RISK", title: "Flooding delays works", seriousness: "HIGH", mitigation: "Work in the dry season" }), item({ kind: "ASSUMPTION", title: "Roads stay open", seriousness: "LOW", mitigation: null })],
  };
  const extras = emptyExtras(false);
  extras.start = { donor: "European Union", sector: "WASH", country: "Uganda", withDocuments: false };
  extras.team = [
    person("me", "Launch Admin", "ME_OFFICER", adminEmail),
    person("pm", "Pat Manager", "PROJECT_MANAGER", pmEmail),
    person("fo", "Fay Officer", "FIELD_OFFICER", foEmail, "NOW"),
  ];
  extras.indicatorSetup = { I1: { ownerKey: "me", method: "FORM", directionConfirmed: true }, I2: { ownerKey: "pm", method: "MANUAL", directionConfirmed: true } };
  extras.planSetup = { [planKeyOf({ planCode: "1.1", title: "Rehabilitate boreholes", start: "2027-04-01" })]: { placeNames: ["Gulu District"], projectWide: false, indicatorCodes: ["I1"], leadKey: "fo", requiredFiles: [], recordsParticipants: true } };
  extras.projectArea = "Gulu District";
  extras.collection = { reviewMode: "SIMPLE", windowRule: { opensDaysBefore: 10, closesDaysAfter: 15 } };
  extras.schedule = { cadence: "QUARTERLY", reminders: true, rules: [{ reportType: "QUARTERLY", template: "BUILT_IN", dueDaysAfterEnd: 30 }] };
  extras.finance = { reportingCurrency: "EUR", differenceAcknowledged: false, budgetPlan: { b1: planKeyOf({ planCode: "1.1", title: "Rehabilitate boreholes", start: "2027-04-01" }) } };
  extras.dashboardTemplate = "tpl-wash-access-hygiene";
  extras.answers = { "project.partners": { notUsed: true } };

  const id = `psp-launch-${stamp}`;
  await c.prisma.projectSetupProposal.create({
    data: {
      id, tenantId: signedUp.tenantId, createdById: signedUp.userId, status: "READY", sourceName: "", sourceStorageKey: "", sourceHash: "", sourceLength: 0,
      proposalJson: JSON.stringify(proposal), extrasJson: JSON.stringify(extras), problemsJson: "[]", expiresAt: new Date(Date.now() + 864e5),
    },
  });

  // Every requirement is met, but nothing starts without a sign-off, and the draft view says what stops it.
  const before = must(await h.getSetupDraft.handle(ctx, id), "draft view");
  assert.deepEqual(before.inbox.map((r) => [r.key, r.code, r.params]), [], "every requirement is met");
  assert.deepEqual(before.launch.blockers, [{ kind: "SIGN_OFF_MISSING" }]);
  const unsigned = await h.launchProject.handle(ctx, id);
  assert.equal(unsigned.ok, false);
  assert.match(unsigned.error.message, /Sign off/);

  must(await h.signOffSetup.handle(ctx, id), "sign off");
  const report = must(await h.launchProject.handle(ctx, id), "launch");
  assert.equal(report.status, "LAUNCHED", JSON.stringify([report.areas.filter((a) => a.status !== "APPLIED"), report.steps.filter((s) => s.status !== "DONE")]));
  const projectId = report.projectId;

  // The project and its parts, made by the existing handlers.
  const project = await c.prisma.project.findFirst({ where: { id: projectId } });
  assert.equal(project.title, "Blue Water Launch");
  assert.equal(project.donorName, "European Union");
  assert.equal(project.reportingFrequency, "QUARTERLY");
  assert.equal(project.status, "ACTIVE", "the project is started when the launch finishes");
  assert.equal(await c.prisma.indicator.count({ where: { projectId } }), 2);
  const plan = await c.prisma.plannedActivity.findMany({ where: { projectId } });
  assert.equal(plan.length, 1, JSON.stringify(report.areas.map((a) => [a.area, a.status, a.created, a.skipped, a.notes])));
  assert.equal(plan[0].location, "Gulu District", "the place the person chose became the activity's location");

  // The wizard's own steps.
  const profile = await c.prisma.reportingProfile.findFirst({ where: { projectId } });
  assert.equal(profile.simpleReview, true);
  const periods = await c.prisma.reportingPeriod.findMany({ where: { projectId } });
  assert.equal(periods.length, 3, "three quarters; the fourth block belongs to the final report, which is opened separately");
  assert.ok(periods.every((p) => p.entryOpensOn && p.entryClosesOn), "every period has an entry window");
  const forms = await c.prisma.collectionForm.findMany({ where: { projectId } });
  assert.equal(forms.length, 1, "one draft form, for the indicator collected by a form");
  assert.notEqual(forms[0].status, "PUBLISHED", "forms are drafted, never published");
  assert.equal(await c.prisma.invitation.count({ where: { tenantId: signedUp.tenantId, email: foEmail } }), 1, "invited when the project started: " + JSON.stringify(report.steps));

  // The person who has an account was added and owns what was set; the one without is remembered.
  const ind = Object.fromEntries((await c.prisma.indicator.findMany({ where: { projectId } })).map((i) => [i.code, i]));
  assert.equal(ind.I1.responsibleUserId, signedUp.userId);
  assert.equal(ind.I2.responsibleUserId ?? null, null, "not yet: Pat has no account");
  const pending = await c.prisma.projectPendingMember.findMany({ where: { tenantId: signedUp.tenantId }, orderBy: { email: "asc" } });
  assert.deepEqual(pending.map((p) => [p.email, p.projectId, p.role]), [[foEmail, projectId, "FIELD_OFFICER"], [pmEmail, projectId, "PROJECT_MANAGER"]], "everyone named without an account is remembered, with or without responsibilities");

  // Budget lines are made on their activity, the starting dashboard is made for the project, and nothing is published or approved.
  const lines = await c.prisma.budgetLine.findMany({ where: { projectId } });
  assert.deepEqual(lines.map((l) => [l.plannedActivityId === plan[0].id, l.code, l.category, l.currency, Number(l.amountMinor)]), [[true, "B1", "OTHER", "EUR", 40000000]]);
  const dashboards = await c.prisma.dashboard.findMany({ where: { tenantId: signedUp.tenantId, projectId } });
  assert.equal(dashboards.length, 1, JSON.stringify(report.steps.find((s) => s.key === "DASHBOARD")));
  assert.ok(JSON.parse(dashboards[0].widgetsJson).length > 0);
  assert.equal(plan[0].ownerUserId ?? null, null, "Fay has not joined, so the lead is kept for her");

  // The report is honest about what a launch does not write.
  assert.ok(report.notWritten.every((s) => !/checklist|approver|verifier|evidence/i.test(s)));

  // A second launch of the same setup is refused.
  const again = await h.launchProject.handle(ctx, id);
  assert.equal(again.ok, false);

  // Pat joins by an ordinary invitation (the People page), not by the launch.
  const invited = must(await h.inviteUser.handle(ctx, { email: pmEmail, role: "PROJECT_MANAGER" }), "invite Pat");
  const joined = must(await h.acceptInvitation.handle({ token: invited.token, name: "Pat Manager", password: "Correct-Horse-9-Battery" }), "accept");
  const membership = await c.prisma.projectMember.findFirst({ where: { projectId, userId: joined.userId } });
  assert.ok(membership, "Pat is a member of the project");
  assert.equal(membership.role, "PROJECT_MANAGER");
  const i2 = await c.prisma.indicator.findFirst({ where: { projectId, code: "I2" } });
  assert.equal(i2.responsibleUserId, joined.userId, "and owns the indicator the setup gave them");
  assert.equal(await c.prisma.projectPendingMember.count({ where: { tenantId: signedUp.tenantId } }), 1, "Pat's record is removed once it is used; Fay has not joined yet");

  // Fay was invited when the project started: her invitation already made her a member, and accepting finishes her record.
  const fay = await c.prisma.invitation.findFirst({ where: { tenantId: signedUp.tenantId, email: foEmail } });
  const fayJoined = must(await h.acceptInvitation.handle({ token: fay.token, name: "Fay Officer", password: "Correct-Horse-9-Battery" }), "accept Fay");
  assert.equal(await c.prisma.projectMember.count({ where: { projectId, userId: fayJoined.userId } }), 1, "one membership, not two");
  const led = await c.prisma.plannedActivity.findFirst({ where: { projectId } });
  assert.equal(led.ownerUserId, fayJoined.userId, "she leads the activity the setup gave her");
  assert.equal(await c.prisma.projectPendingMember.count({ where: { tenantId: signedUp.tenantId } }), 0);
});
