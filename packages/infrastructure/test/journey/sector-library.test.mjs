// Phase 46 on the real stack: a person picks sectors on the wizard, chooses indicators and suggested results from the library, the draft
// is launched through the real handlers and Postgres, and the project's indicators remember their library entries. Then, on the
// project, more are added from the library, a changed entry is shown as a difference, and one organisation's own library records
// are invisible to another. Opt-in: UOW_VERIFY_DATABASE_URL=postgresql://... (a migrated scratch database)
import assert from "node:assert/strict";
import test from "node:test";
import { TenantId, emptyExtras, planKeyOf, parseLink } from "@donordesk/domain";

const url = process.env.UOW_VERIFY_DATABASE_URL;
const skip = url ? false : "set UOW_VERIFY_DATABASE_URL to a migrated scratch database";
process.env.JWT_SECRET ??= "test-secret-that-is-at-least-32-characters";
if (url) { process.env.DATABASE_URL = url; process.env.DATABASE_ADMIN_URL = url; }
const must = (r, what) => { assert.equal(r.ok, true, `${what}: ${r.ok ? "" : r.error.message}`); return r.value; };
const item = (value) => ({ value, sourceQuote: null, sourceRef: null, confidence: "HIGH", status: "EDITED" });
const person = (key, name, role, email, invite = "LATER") => ({ key, name, email, role, external: false, invite });

test("journey: sectors, library indicators and suggested results through the wizard, launch, adoption on the project, updates and tenant isolation", { skip }, async (t) => {
  const { createContainer } = await import("../../dist/container.js");
  const c = createContainer({ useAdminConnection: true });
  t.after(async () => { await c.settleBackgroundWork(); await c.prisma.$disconnect(); });
  const h = c.handlers;
  const stamp = Date.now();
  const adminEmail = `lib-${stamp}@example.org`;

  const signedUp = must(await h.signUp.handle({ name: "Library Admin", email: adminEmail, password: "Correct-Horse-9-Battery", organization: { name: `Library Org ${stamp}`, organizationType: "LOCAL_NGO", country: "Uganda", primarySector: "WASH" } }), "sign up");
  await c.prisma.entitlementGrant.create({ data: { id: `eg-${stamp}`, tenantId: signedUp.tenantId, planCode: "ENTERPRISE", source: "MANUAL", effectiveFrom: new Date(Date.now() - 1000), reason: "library journey" } });
  const tenantId = TenantId.create(signedUp.tenantId);
  const ctx = { tenant: { tenantId, userId: signedUp.userId, role: "ADMIN" }, requestId: "library-journey" };

  // The wizard: sectors first. The main one becomes the sector the project is filed under.
  const started = must(await h.startBlankSetup.handle(ctx, {}), "start");
  const id = started.proposalId ?? started.id;
  must(await h.editSetupDraft.handle(ctx, id, { kind: "SET_START", patch: { donor: "European Union", country: "Uganda" } }), "start answers");
  const bad = await h.editSetupDraft.handle(ctx, id, { kind: "SET_SECTORS", sectorIds: ["NOPE"] });
  assert.equal(bad.ok, false);
  const attached = await h.editSetupDraft.handle(ctx, id, { kind: "SET_SECTORS", sectorIds: ["PROTECTION_AAP"] });
  assert.equal(attached.ok, false, "an attached pack cannot be the main sector");
  const sectored = must(await h.editSetupDraft.handle(ctx, id, { kind: "SET_SECTORS", sectorIds: ["WASH", "HEALTH"] }), "sectors");
  assert.deepEqual(sectored.extras.start.sectors, ["WASH", "HEALTH"]);
  assert.equal(sectored.extras.start.sector, "WASH");
  must(await h.editSetupDraft.handle(ctx, id, { kind: "SET_LIBRARY_ANSWER", key: "season", value: "Rains in April and October" }), "answer");

  // The suggested results, then indicators chosen from the library (the wizard edits the proposal itself).
  const withResults = must(await h.addSetupLibrary.handle(ctx, id, { kind: "ADD_FROM_SKELETON", sectorId: "WASH" }), "skeleton");
  assert.ok(withResults.logframe.length >= 7);
  assert.ok(withResults.logframe.some((n) => n.value.level === "ACTIVITY"), "the suggested results come with their activities");
  const wanted = ["WASH-W-08", "WASH-Q-02", "WASH-S-03", "WASH-H-01", "WASH-S-02", "WASH-W-01", "HLT-R-01"];
  const picked = must(await h.addSetupLibrary.handle(ctx, id, { kind: "ADD_FROM_LIBRARY", ids: wanted, logframeCode: null }), "library indicators");
  const codes = picked.indicators.map((i) => i.value.code).sort();
  assert.deepEqual(codes, [...wanted].sort());
  // Each lands under the suggested result it measures, not the first result at its level.
  const titleOf = (code) => picked.logframe.find((n) => n.value.code === picked.indicators.find((i) => i.value.code === code).value.logframeCode).value.title;
  assert.equal(titleOf("WASH-Q-02"), "Water is tested and treated to stay safe");
  assert.equal(titleOf("WASH-S-03"), "Toilets are built, safe and used");
  assert.equal(titleOf("WASH-H-01"), "Hygiene sessions held and hygiene items distributed");
  assert.equal(titleOf("WASH-W-01"), "People have enough safe water for drinking, cooking and hygiene");
  must(await h.editSetupDraft.handle(ctx, id, { kind: "CONFIRM_CODES", codes: picked.logframe.map((n) => n.value.code) }), "confirm codes");
  const activities = picked.logframe.filter((n) => n.value.level === "ACTIVITY").map((n) => n.value);
  const activity = activities[0];
  const w1 = picked.indicators.find((i) => i.value.code === "WASH-W-01").value;
  assert.equal(w1.libraryId, "WASH-W-01");
  assert.equal(w1.target, null, "the library never sets a target");
  assert.match(w1.referenceText, /at least 15 l\/p\/d/);
  assert.ok(w1.logframeCode, "linked to the nearest result at its own level");
  const twice = await h.addSetupLibrary.handle(ctx, id, { kind: "ADD_FROM_LIBRARY", ids: ["WASH-W-01"] });
  assert.equal(twice.ok, false, "nothing is added twice");

  // The rest of the draft, as a person would fill the other slides (the library does not touch them).
  const stored = await c.prisma.projectSetupProposal.findFirst({ where: { id } });
  const proposal = JSON.parse(stored.proposalJson);
  proposal.facts = { ...proposal.facts, name: item("Library Launch"), code: item(`LIB-${stamp}`), startDate: item("2027-03-01"), endDate: item("2028-02-29"), currency: item("EUR"), summary: item("Safe water."), donor: item(null), countries: item(["Uganda"]), sectors: item(["WASH"]) };
  proposal.places = [item({ name: "Uganda", adminLevel: 0, parentName: null, latitude: null, longitude: null }), item({ name: "Gulu District", adminLevel: 2, parentName: "Uganda", latitude: null, longitude: null })];
  // Every activity of the suggested results needs a planned activity before the project can start (the wizard's own rule).
  proposal.plan = activities.map((a, n) => item({ title: a.title, logframeCode: a.code, start: "2027-04-01", end: "2027-09-30", location: null, lead: null, planCode: `1.${n + 1}` }));
  const planKey = (n) => planKeyOf({ planCode: `1.${n + 1}`, title: activities[n].title, start: "2027-04-01" });
  proposal.funding = [item({ sourceName: "European Union", amount: "400000", currency: "EUR" })];
  proposal.budget = [item({ category: "Boreholes", amount: "400000", currency: "EUR", logframeCode: null, kind: "LINE", key: "b1" })];
  proposal.risks = [item({ kind: "RISK", title: "Flooding delays works", seriousness: "HIGH", mitigation: "Work in the dry season" }), item({ kind: "ASSUMPTION", title: "Roads stay open", seriousness: "LOW", mitigation: null })];
  for (const i of proposal.indicators) { i.value.baseline = "0"; i.value.target = "100"; }
  const extras = JSON.parse(stored.extrasJson ?? JSON.stringify(emptyExtras(false)));
  extras.team = [person("me", "Library Admin", "ME_OFFICER", adminEmail), person("pm", "Pat Manager", "PROJECT_MANAGER", `pm-${stamp}@example.org`)];
  extras.indicatorSetup = Object.fromEntries(codes.map((code) => [code, { ownerKey: "me", method: "MANUAL", directionConfirmed: true }]));
  extras.planSetup = Object.fromEntries(activities.map((_a, n) => [planKey(n), { placeNames: ["Gulu District"], projectWide: false, indicatorCodes: ["WASH-S-02"], leadKey: "me", requiredFiles: [], recordsParticipants: false }]));
  extras.projectArea = "Gulu District";
  extras.collection = { reviewMode: "SIMPLE", windowRule: { opensDaysBefore: 10, closesDaysAfter: 15 } };
  extras.schedule = { cadence: "QUARTERLY", reminders: true, rules: [{ reportType: "QUARTERLY", template: "BUILT_IN", dueDaysAfterEnd: 30 }] };
  extras.finance = { reportingCurrency: "EUR", differenceAcknowledged: false, budgetPlan: { b1: planKey(0) } };
  extras.dashboardTemplate = "tpl-wash-access-hygiene";
  extras.answers = { "project.partners": { notUsed: true } };
  await c.prisma.projectSetupProposal.update({ where: { id }, data: { proposalJson: JSON.stringify(proposal), extrasJson: JSON.stringify(extras) } });

  const view = must(await h.getSetupDraft.handle(ctx, id), "draft view");
  assert.deepEqual(view.inbox.map((r) => [r.key, r.code]), [], "every requirement is met");
  must(await h.signOffSetup.handle(ctx, id), "sign off");
  const report = must(await h.launchProject.handle(ctx, id), "launch");
  assert.equal(report.status, "LAUNCHED", JSON.stringify([report.areas.filter((a) => a.status !== "APPLIED"), report.steps.filter((s) => s.status !== "DONE" && s.status !== "ALREADY_DONE")]));
  assert.equal(report.steps[0].key, "LIBRARY_LINKS");
  assert.equal(report.steps[0].done, 7, "every library indicator was linked");
  const projectId = report.projectId;

  const project = await c.prisma.project.findFirst({ where: { id: projectId } });
  assert.equal(project.sector, "WASH");
  assert.match(project.description ?? "", /Starting assessment[\s\S]*season: Rains in April and October/);
  const rows = Object.fromEntries((await c.prisma.indicator.findMany({ where: { projectId } })).map((i) => [i.code, i]));
  assert.equal(rows["WASH-W-01"].libraryId, "WASH-W-01");
  assert.equal(rows["WASH-W-01"].libraryVersion, 1);
  assert.equal(parseLink(rows["WASH-W-01"].libraryJson).snapshot.referenceStandard.value, 15);
  assert.equal(JSON.parse(rows["WASH-W-01"].semanticsJson).direction, "HIGHER_IS_BETTER");
  assert.equal(JSON.parse(rows["WASH-W-01"].semanticsJson).status, "REQUIRES_REVIEW");
  assert.equal(rows["WASH-W-01"].type, "RATIO");
  assert.equal(rows["WASH-S-02"].type, "NUMBER");

  // The logframe list and the entry rows carry the reference standard, separate from the target.
  const lf = must(await h.listLogframe.handle(ctx, projectId), "logframe");
  const w01 = lf.indicators.find((i) => i.code === "WASH-W-01");
  assert.equal(w01.library.id, "WASH-W-01");
  assert.match(w01.library.referenceText, /at least 15/);
  assert.equal(w01.target, "100", "the person's own target");

  // On the project: add more from the library through the ordinary create handler; what is already there is not offered again.
  const browse = must(await h.browseSectorLibrary.handle(ctx, { projectId, sectors: ["WASH"] }), "browse");
  const offered = browse.groups.flatMap((g) => g.entries).map((e) => e.id);
  assert.ok(!offered.includes("WASH-W-01"));
  assert.ok(offered.includes("WASH-V-01"));
  const adopted = must(await h.adoptLibraryIndicators.handle(ctx, { projectId, items: [{ libraryId: "WASH-V-01" }, { libraryId: "WASH-Q-01" }] }), "adopt");
  assert.equal(adopted.created.length, 2);
  const h01 = await c.prisma.indicator.findFirst({ where: { projectId, code: "WASH-V-01" } });
  assert.equal(h01.libraryId, "WASH-V-01");
  assert.equal(h01.target, "", "an adopted indicator has no target until the person sets one");
  assert.ok(await c.prisma.auditEvent.findFirst({ where: { tenantId: signedUp.tenantId, eventType: "sector_library.adopted" } }));
  const again = must(await h.adoptLibraryIndicators.handle(ctx, { projectId, items: [{ libraryId: "WASH-V-01" }] }), "adopt again");
  assert.equal(again.created.length, 0);

  // A reworded entry shows up as a difference on the project that copied it; applying carries only the ticked field.
  must(await h.saveLibraryEntry.handle(ctx, { kind: "OVERRIDE", entryId: "WASH-V-01", patch: { name: "Households with a breeding site for flies or mosquitoes near the home" } }), "reword");
  const updates = must(await h.checkLibraryUpdates.handle(ctx, projectId), "updates");
  const changed = updates.find((u) => u.libraryId === "WASH-V-01");
  assert.equal(changed.update.state, "CHANGED");
  assert.deepEqual(changed.update.changes.map((x) => x.field), ["name"]);
  must(await h.applyLibraryUpdate.handle(ctx, { indicatorId: changed.indicatorId, fields: ["name"] }), "apply");
  assert.equal((await c.prisma.indicator.findFirst({ where: { id: changed.indicatorId } })).name, "Households with a breeding site for flies or mosquitoes near the home");
  assert.equal(must(await h.checkLibraryUpdates.handle(ctx, projectId), "updates again").find((u) => u.libraryId === "WASH-V-01").update.state, "CURRENT");

  // The skeleton on the project reuses results that exist and adds the missing ones.
  const skeleton = must(await h.adoptLibraryLogframe.handle(ctx, { projectId, sectorId: "WASH" }), "skeleton on project");
  assert.ok(skeleton.reused.length >= 3);

  // One organisation's own records are invisible to another (row-level security, not only a filter).
  const other = must(await h.signUp.handle({ name: "Other Admin", email: `other-${stamp}@example.org`, password: "Correct-Horse-9-Battery", organization: { name: `Other Org ${stamp}`, organizationType: "LOCAL_NGO", country: "Kenya", primarySector: "HEALTH" } }), "other tenant");
  const octx = { tenant: { tenantId: TenantId.create(other.tenantId), userId: other.userId, role: "ADMIN" }, requestId: "other" };
  const otherView = must(await h.browseSectorLibrary.handle(octx, { sectors: ["WASH"] }), "other browse");
  assert.equal(otherView.groups.flatMap((g) => g.entries).find((e) => e.id === "WASH-V-01").reworded, false, "the other organisation sees the library's own wording");
  const scoped = createContainer({ tenantId: signedUp.tenantId });
  t.after(async () => { await scoped.prisma.$disconnect(); });
  const rls = await scoped.prisma.organisationLibraryEntry.count({ where: { tenantId: other.tenantId } });
  assert.equal(rls, 0, "row-level security hides another organisation's records even when asked for them");
});
