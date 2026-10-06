import assert from "node:assert/strict";
import test from "node:test";
import { AiReporterDraftGenerator } from "../../dist/llm/ai-reporter-draft-generator.js";
import { StubReportDraftGenerator } from "../../dist/llm/report-draft-generator.js";
import {
  CancelReportingPeriodHandler, ConvertPeriodToFinalHandler, RestoreReportingPeriodHandler, GetComplianceNotesHandler, SaveSectionNoteHandler,
  ApproveReportHandler, BulkResolveChecklistHandler, BulkVerifyEvidenceHandler, ReportRevisionService,
} from "@donordesk/application";
import { ChecklistItem, ReportingPeriod, ReportSection, TenantId } from "@donordesk/domain";

/**
 * Journey: one reporting cycle through the Phase 25 behaviours, with the real handlers over in-memory ports.
 *   periods (cancel, restore, make final) -> a compliance statement -> generation (the AI first states an invented
 *   figure, recovers on the retry, then fails and says why) -> approval with the second-approver rule -> attestations.
 * `pnpm journey` runs this file.
 */
const tenantId = TenantId.create("tenant-j");
const ok = (value) => ({ ok: true, value });
const as = (userId, role = "ADMIN") => ({ tenant: { tenantId, userId, role }, requestId: "journey" });
const month = (id, type, m) => ReportingPeriod.create({ id, tenantId: "tenant-j", projectId: "proj", reportType: type, startDate: new Date(Date.UTC(2026, m, 1)), endDate: new Date(Date.UTC(2026, m + 1, 0)), deadline: new Date(Date.UTC(2026, m + 1, 10)) });

const world = () => {
  const periods = new Map([["mar", month("mar", "MONTHLY", 2)], ["apr", month("apr", "MONTHLY", 3)]]);
  const audits = [];
  const periodRepo = {
    findById: async (id) => ok(periods.get(id) ?? null),
    findByProject: async (_p, _t, o = {}) => ok([...periods.values()].filter((p) => o.includeCancelled || !p.isCancelled)),
    findPreviousPeriods: async (_p, id) => ok([...periods.values()].filter((p) => p.id !== id && p.duration.start < periods.get(id).duration.start)),
    update: async (p) => ok(p),
  };
  const draftRepo = { findByReportingPeriod: async () => ok([]) };
  return { periods, audits, periodRepo, draftRepo, audit: { record: async (e) => { audits.push(e.eventType); } } };
};

test("the Phase 25 reporting cycle, end to end", async () => {
  const w = world();

  // 1. April was created as a regular month but is the closing block: make it final, undo it by cancelling, restore.
  const convert = new ConvertPeriodToFinalHandler(w.periodRepo, w.draftRepo, w.audit);
  assert.equal((await convert.handle(as("pm"), "mar")).ok, false, "March is not the last block");
  assert.equal((await convert.handle(as("pm"), "apr")).value.reportType, "FINAL");
  w.periods.set("apr", month("apr", "MONTHLY", 3));
  await new CancelReportingPeriodHandler(w.periodRepo, w.draftRepo, w.audit).handle(as("pm"), "apr", { reason: "journey" });
  assert.deepEqual((await w.periodRepo.findByProject("proj", tenantId)).value.map((p) => p.id), ["mar"]);
  assert.equal((await new RestoreReportingPeriodHandler(w.periodRepo, w.draftRepo, w.audit).handle(as("pm"), "apr")).ok, true);

  // 2. March's environmental statement is carried to April ("same as last month").
  const sections = [{ id: "env", title: "Environmental Compliance" }, { id: "res", title: "Results" }];
  const builder = (period) => ({ loadBase: async () => ok({ period, templateSections: sections }) });
  w.periods.get("mar").setSectionNote("env", "Waste sorted at all sites.");
  const view = (await new GetComplianceNotesHandler(builder(w.periods.get("apr")), w.periodRepo).handle(as("me"), "apr")).value;
  assert.deepEqual([view.sections.length, view.sections[0].previousNote, view.missingCount], [1, "Waste sorted at all sites.", 1]);
  await new SaveSectionNoteHandler(builder(w.periods.get("apr")), w.periodRepo, w.audit).handle(as("me"), "apr", { key: "env", note: view.sections[0].previousNote });
  assert.equal(w.periods.get("apr").storyContext.sectionNotes.env, "Waste sorted at all sites.");

  // 3. Generation: the AI states an invented figure, is asked again naming it, and recovers; a second invented figure falls back with a reason.
  const issue = "UNGROUNDED_NUMBER: 33.3 do not appear in the verified inputs";
  const reply = (content, telemetry = {}) => ({ sectionId: "s", title: "Results", content, claims: [], sourceReferences: [], telemetry: { validatorIssues: [], qualityWarnings: [], ...telemetry } });
  const script = (...steps) => { const calls = []; return { calls, draftSection: async (r) => { calls.push(r); return ok(steps[Math.min(calls.length - 1, steps.length - 1)]); }, rewriteSection: async () => { throw new Error("unused"); }, health: async () => ok({ ok: true }) }; };
  const input = { reportPlan: { tenantId: "tenant-j", sections: [] }, verifiedFindings: [], evidencePackages: [], activities: [], indicatorUpdates: [], reportingProfileSnapshot: {}, generationRunId: "run", draftedSections: [] };
  const sec = { templateSectionId: "res", title: "Results", inputType: "NARRATIVE", required: true, mandatoryQuestions: [], evidenceNeeds: [] };
  const generator = (worker) => new AiReporterDraftGenerator(worker, new StubReportDraftGenerator(), undefined, undefined, undefined, undefined, 4, { provider: "openai", model: "m" });
  const recovering = script(reply("Reached 33.3% of target.", { usedFallback: true, validatorIssues: [issue] }), reply("Reached the target."));
  const recovered = await generator(recovering).generateSection(input, sec);
  assert.equal(recovered.usedFallback, false);
  assert.match(recovering.calls[1].section.userInstruction, /Do not state 33\.3/);
  const failing = await generator(script(reply("x 33.3", { usedFallback: true, validatorIssues: [issue] }))).generateSection(input, sec);
  assert.deepEqual([failing.usedFallback, failing.fallbackReason, failing.fallbackDetail], [true, "VALIDATOR_FAILED", "figure not in your data: 33.3"]);

  // 4. The reason is stored on the section and cleared by the next write.
  const section = ReportSection.create({ id: "s1", tenantId: "tenant-j", reportDraftId: "d", sectionTitle: "Results", sectionOrder: 1 });
  const revisions = new ReportRevisionService({ createNextForSection: async (i) => ok({ id: "r1", ...i }) }, { update: async (s) => ok(s) }, { normalizeAndHash: (t) => t });
  await revisions.commitChange({ tenantId, section, content: "t", sourceReferences: [], unsupportedClaims: [], changeOrigin: "GENERATION", actorId: "u", generationFallback: { reason: failing.fallbackReason, detail: failing.fallbackDetail } });
  assert.equal(section.generationFallback.reason, "VALIDATOR_FAILED");
  await revisions.commitChange({ tenantId, section, content: "t2", sourceReferences: [], unsupportedClaims: [], changeOrigin: "REGENERATION", actorId: "u" });
  assert.equal(section.generationFallback, undefined);

  // 5. Approval with the second-approver rule: the author is refused, the project manager approves.
  const draft = { id: "d", projectId: "proj", reportingPeriodId: "apr", createdById: "me", approve() {} };
  const approve = new ApproveReportHandler(
    { findById: async () => ok(draft), update: async (d) => ok(d) }, w.periodRepo, {}, {}, {}, {}, {}, w.audit, undefined, undefined,
    { profiles: { findByProject: async () => ok({ requireSecondApprover: true }) }, projects: { findById: async () => ok({}) }, members: { findByProject: async () => ok([{ userId: "pm", role: "PROJECT_MANAGER", status: "ACTIVE" }]) } },
  );
  approve.evaluateGate = async () => ok({ approvalBlocked: false, submitBlocked: false, submitNeedsDecision: false, blockReasons: [], blockingIssues: [] });
  assert.match((await approve.handle(as("me", "ME_OFFICER"), "d")).error.message, /other than you/);
  assert.equal((await approve.handle(as("pm", "PROJECT_MANAGER"), "d")).ok, true);

  // 6. Evidence and attestations: a month of files verified at once; only an administrator or project manager attests in bulk.
  const verified = [];
  const bulkVerify = await new BulkVerifyEvidenceHandler({ handle: async (_c, id) => (verified.push(id), ok(undefined)) }).handle(as("me"), { evidenceIds: ["e1", "e2", "e3"] });
  assert.deepEqual([bulkVerify.succeeded, verified.length], [3, 3]);
  const items = new Map([["sign", ChecklistItem.create({ id: "sign", tenantId: "tenant-j", projectId: "proj", reportingPeriodId: "apr", type: "MISSING_APPROVAL", title: "Sign-off", description: "d", severity: "MEDIUM" })]]);
  const bulk = new BulkResolveChecklistHandler({ findById: async (id) => ok(items.get(id) ?? null), update: async (i) => ok(i) }, w.audit);
  assert.equal((await bulk.handle(as("me", "ME_OFFICER"), { itemIds: ["sign"], decision: "RESOLVE", notes: "ok" })).value.notPermitted, 1);
  assert.equal((await bulk.handle(as("pm", "PROJECT_MANAGER"), { itemIds: ["sign"], decision: "RESOLVE", notes: "ok" })).value.resolved, 1);
  assert.equal(items.get("sign").attestedById, "pm");

  // The trail: every step above left an audit event.
  for (const type of ["reporting_period.converted_to_final", "reporting_period.cancelled", "reporting_period.restored", "reporting_period.section_note_saved", "report.approved"]) {
    assert.ok(w.audits.includes(type), type);
  }
});
