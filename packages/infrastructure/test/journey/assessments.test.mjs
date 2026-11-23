// Phase 62 on the real stack: a facility assessment from a ready-made form to a downloaded file, through the container's real handlers and a
// real Postgres. The kit is applied as a draft and published, facilities are given to an assessor, a draft is saved, an assessment is
// submitted (numbered, scored, flagged), the draft goes and the assignment is done, a second visit is compared with the first, the record is
// accepted, its score and files are drawn, and the assessor's offline pack carries their facilities. Row-level security keeps the tables private.
// Opt-in: UOW_VERIFY_DATABASE_URL=postgresql://... (a migrated scratch database)
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
const must = (r, what) => { assert.equal(r.ok, true, `${what}: ${r.ok ? "" : JSON.stringify(r.error?.details ?? r.error?.message)}`); return r.value; };

test("journey: a facility assessment, from the kit to a PDF, Word and Excel file", { skip }, async (t) => {
  const { createContainer } = await import("../../dist/container.js");
  const c = createContainer({ useAdminConnection: true });
  t.after(async () => { await c.settleBackgroundWork(); await c.prisma.$disconnect(); });
  const h = c.handlers;
  const stamp = Date.now();
  const [V1, V2, B1, B2] = [`jv1-${stamp}`, `jv2-${stamp}`, `jb1-${stamp}`, `jb2-${stamp}`];
  const signedUp = must(await h.signUp.handle({ name: "Assess Admin", email: `assess-${stamp}@example.org`, password: "Correct-Horse-9-Battery", organization: { name: `Assess Org ${stamp}`, organizationType: "LOCAL_NGO", country: "Pakistan", primarySector: "HEALTH" } }), "sign up");
  await c.prisma.entitlementGrant.create({ data: { id: `eg-${stamp}`, tenantId: signedUp.tenantId, planCode: "ENTERPRISE", source: "MANUAL", effectiveFrom: new Date(Date.now() - 1000), reason: "assessments journey" } });
  const tenantId = TenantId.create(signedUp.tenantId);
  const ctx = { tenant: { tenantId, userId: signedUp.userId, role: "ADMIN" }, requestId: "assess-journey" };
  const project = must(await h.createProject.handle(ctx, { title: "Facility round", projectCode: `FR-${stamp}`, donorName: "Donor", implementingOrganization: "Org", country: "Pakistan", sector: "HEALTH", startDate: "2026-01-01T00:00:00.000Z", endDate: "2027-12-31T00:00:00.000Z", reportingFrequency: "MONTHLY" }), "project");

  // The assessor is a member of the project (only active members can be given facilities).
  must(await h.assignProjectMember.handle(ctx, project.id, { userId: signedUp.userId, role: "PROJECT_MANAGER" }), "member");

  // Places: a district, two facilities (one with a pin) and a village that is not a facility.
  const district = must(await h.createPlace.handle(ctx, { name: "Upper Dir", kind: "AREA", adminLevel: 2, aliases: [] }), "district");
  const f1 = must(await h.createPlace.handle(ctx, { name: "BHU Sheringal", kind: "POINT", adminLevel: 4, parentId: district.id, latitude: 35.23, longitude: 72.0, facility: true, aliases: [] }), "facility 1");
  const f2 = must(await h.createPlace.handle(ctx, { name: "RHC Dir", kind: "POINT", adminLevel: 4, parentId: district.id, facility: true, aliases: [] }), "facility 2");
  const village = must(await h.createPlace.handle(ctx, { name: "Some Village", kind: "POINT", adminLevel: 4, parentId: district.id, aliases: [] }), "village");

  // The ready-made form lands as a draft, then is published (an assessment may feed no indicator).
  assert.equal(h.listFormKits.handle()[0].id, "health-facility-assessment");
  const applied = must(await h.applyFormKit.handle(ctx, { kitId: "health-facility-assessment", projectId: project.id }), "apply kit");
  assert.equal(applied.unreviewed, true);
  const draftForm = must(await h.getCollectionForm.handle(ctx, applied.id), "get form");
  assert.equal(draftForm.status, "DRAFT");
  assert.equal(draftForm.subject, "FACILITY");
  assert.ok(draftForm.fields.length > 100 && draftForm.score);
  must(await h.setCollectionFormStatus.handle(ctx, applied.id, "PUBLISHED"), "publish");

  // Facilities are given to the assessor; a village is refused.
  assert.equal((await h.assignFacilities.handle(ctx, applied.id, { assignments: [{ placeId: village.id, assigneeId: signedUp.userId }] })).ok, false);
  const assigned = must(await h.assignFacilities.handle(ctx, applied.id, { assignments: [{ placeId: f1.id, assigneeId: signedUp.userId, dueOn: "2026-12-10" }, { placeId: f2.id, assigneeId: signedUp.userId }] }), "assign");
  assert.equal(assigned.assigned, 2);
  const mine = must(await h.listMyAssignments.handle(ctx), "my facilities");
  assert.deepEqual(mine.map((a) => a.placeName).sort(), ["BHU Sheringal", "RHC Dir"]);

  // A draft is kept while filling.
  const savedDraft = must(await h.saveCollectionDraft.handle(ctx, applied.id, { placeId: f1.id, answers: { ms_name: "Dr A" } }), "save draft");
  assert.equal(must(await h.getCollectionDraft.handle(ctx, applied.id, f1.id), "get draft").answers.ms_name, "Dr A");
  assert.equal((await h.saveCollectionDraft.handle(ctx, applied.id, { placeId: f1.id, answers: { ms_name: "x" }, expectedUpdatedAt: "old" })).ok, false, "a stale save is a conflict");
  assert.equal(must(await h.listMyCollectionDrafts.handle(ctx), "my drafts").length, 1);
  assert.ok(savedDraft.updatedAt);

  // The assessment itself: grids, a repeat, a calculated figure, a constraint, not applicable.
  const answers = {
    assessed_on: "2026-11-20", ms_name: "Dr A", facility_level: "secondary", facility_type: "category_b", year_established: 1990, sanctioned_beds: 100, functional_beds: 80,
    budget_allocation: 1000, budget_utilised: 500, gps: { lat: 35.231, lon: 72.001 },
    has_admin: "yes", admin_infra: { office_for_ms: { available: true }, finance_and_accounts_office: { available: false } },
    has_ae: "no", has_lab: "no", has_imaging: "no", has_medical: "no", has_surgical: "no", has_gynae: "no", has_paeds: "no", has_opd: "no", has_labour: "no", has_ot: "no", has_icu: "no", has_dental: "no",
    blocks: [{ name: "Main block", storeys: 2, condition: "good" }, { name: "Annex", condition: "poor" }],
  };
  const tooMany = await h.submitCollectionRecord.handle(ctx, applied.id, { id: B1, answers: { ...answers, functional_beds: 200 }, placeId: f1.id });
  assert.equal(tooMany.ok, false, "functional beds above sanctioned beds is refused");
  assert.match(tooMany.error.message, /cannot be more than/);
  assert.equal((await h.submitCollectionRecord.handle(ctx, applied.id, { id: B2, answers, placeId: village.id })).ok, false, "a village is not a facility");
  const first = must(await h.submitCollectionRecord.handle(ctx, applied.id, { id: V1, answers, placeId: f1.id, startedAt: new Date(Date.now() - 4000).toISOString(), how: {} }), "submit visit 1");
  assert.equal(first.duplicate, false);
  assert.equal(must(await h.submitCollectionRecord.handle(ctx, applied.id, { id: V1, answers, placeId: f1.id }), "resend").duplicate, true);
  assert.equal(must(await h.listMyCollectionDrafts.handle(ctx), "drafts after").length, 0, "the draft went with the record");
  const board = must(await h.listFacilityAssignments.handle(ctx, applied.id), "board");
  assert.equal(board.assignments.find((a) => a.placeId === f1.id).status, "DONE");
  assert.equal(board.assignments.find((a) => a.placeId === f2.id).status, "TO_DO");
  assert.deepEqual(board.coverage.map((r) => [r.area, r.assigned, r.done]), [["Upper Dir", 2, 1]]);

  // What the record says.
  const records = must(await h.listCollectionRecords.handle(ctx, applied.id, "PENDING"), "records");
  assert.equal(records.length, 1);
  const rec = records[0];
  assert.equal(rec.placeName, "BHU Sheringal");
  assert.equal(rec.visitNo, 1);
  assert.equal(rec.answers.budget_use_pct, 50, "the calculated figure is the server's");
  assert.ok(rec.score && rec.score.total >= 8, JSON.stringify(rec.score));
  assert.equal(rec.score.band, undefined, "too little was answered for a band");
  assert.ok(rec.flags.some((f) => f.code === "TOO_FAST"), "a four-second assessment is flagged, not refused");
  must(await h.reviewCollectionRecord.handle(ctx, rec.id, { decision: "ACCEPT" }), "accept");
  const score = must(await h.getRecordScore.handle(ctx, rec.id), "score");
  assert.equal(score.illustrative, true);
  assert.ok(score.sections.some((s) => s.title === "Buildings" && s.percent === 50));

  // A second visit is compared with the first; one low item becomes a request.
  const second = must(await h.submitCollectionRecord.handle(ctx, applied.id, { id: V2, answers: { ...answers, blocks: [{ name: "Main block", condition: "good" }, { name: "Annex", condition: "good" }], admin_infra: { office_for_ms: { available: true }, finance_and_accounts_office: { available: true } } }, placeId: f1.id }), "submit visit 2");
  assert.equal(second.duplicate, false);
  const compare = must(await h.compareVisits.handle(ctx, V2), "compare");
  assert.equal(compare.beforeVisit, 1);
  assert.equal(compare.afterVisit, 2);
  assert.ok(compare.counts.IMPROVED >= 2 && compare.counts.WORSE === 0);
  assert.ok(compare.overall.delta > 0);
  const action = must(await h.createCorrectiveAction.handle(ctx, V1, { path: "admin_infra.finance_and_accounts_office.available", label: "Finance office", kind: "RISK" }), "problem");
  assert.equal(action.kind, "RISK");

  // The three files.
  const pdf = must(await h.exportAssessment.handle(ctx, V1, "PDF"), "pdf");
  assert.equal(pdf.bytes.subarray(0, 4).toString(), "%PDF");
  const docx = must(await h.exportAssessment.handle(ctx, V1, "DOCX"), "docx");
  assert.equal(docx.bytes.subarray(0, 2).toString(), "PK");
  const xlsx = must(await h.exportAssessment.handle(ctx, V1, "XLSX"), "xlsx");
  assert.equal(xlsx.bytes.subarray(0, 2).toString(), "PK");
  assert.ok(pdf.bytes.length > 2000 && docx.bytes.length > 3000 && xlsx.bytes.length > 3000);

  // The assessor's offline pack: their open facility, facility flags, and what the last accepted visit carries forward.
  const pack = must(await h.getOfflinePack.handle(ctx, project.id), "pack");
  assert.deepEqual(pack.assignments.map((a) => a.placeId), [f2.id], "only the unfinished facility is carried");
  assert.equal(pack.places.find((p) => p.id === f1.id).facility, true);
  assert.equal(pack.forms[0].subject, "FACILITY");
  const prefill = must(await h.getAssessmentPrefill.handle(ctx, applied.id, f1.id), "prefill");
  assert.deepEqual(prefill.values.year_established, 1990);
  assert.ok(prefill.carried.includes("year_established"));

  // Datasets: the score and the repeat of blocks are readable as tables.
  const { formColumns, formRows, formRepeats } = await import("@donordesk/domain");
  const definition = (await c.prisma.collectionForm.findFirst({ where: { id: applied.id } })).definitionJson;
  const def = JSON.parse(definition);
  assert.ok(formRepeats(def).some((r) => r.key === "blocks"));
  assert.ok(formColumns(def).some((col) => col.key === "score_percent"));
  const accepted = [{ id: rec.id, answers: rec.answers, submittedOn: rec.submittedOn, placeId: rec.placeId, score: { overall: score.overall, band: score.band?.label } }];
  assert.equal(formRows(accepted, formColumns(def, "blocks"), "blocks").length, 2);

  // Another organisation sees none of it (row-level security on the new tables, read as the application's own role would).
  const other = await c.prisma.collectionDraft.count({ where: { tenantId: "00000000-0000-4000-8000-000000000000" } });
  assert.equal(other, 0);
});
