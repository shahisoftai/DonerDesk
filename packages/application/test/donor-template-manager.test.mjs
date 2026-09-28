import assert from "node:assert/strict";
import test from "node:test";
import { DonorTemplate, TenantId, createSection, createTemplateRequirements } from "@donordesk/domain";
import {
  InferredReportPlanner,
  PeriodTemplateResolver,
  TemplateExtractionRunner,
  UploadTemplateHandler,
  toPlanSection,
  serializeTemplateSnapshot,
  parseTemplateSnapshot,
  buildTemplateGenerationContext,
  snapshotFromTemplate,
} from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ctx = { tenant: { tenantId, userId: "user-1", role: "ADMIN" }, requestId: "r" };
const ok = (value) => ({ ok: true, value });

function makeTemplate(over = {}) {
  return DonorTemplate.create({
    id: "tpl-1",
    tenantId,
    projectId: "proj-1",
    templateName: "Quarterly",
    donorName: "ECHO",
    reportType: "QUARTERLY",
    language: "en",
    uploadedById: "user-1",
    ...over,
  });
}

function memoryRepo(initial = []) {
  const rows = new Map(initial.map((t) => [t.id, t]));
  const updates = [];
  return {
    rows,
    updates,
    create: async (t) => (rows.set(t.id, t), ok(t)),
    update: async (t, meta) => (rows.set(t.id, t), updates.push({ version: t.version, meta }), ok(t)),
    findById: async (id) => ok(rows.get(id) ?? null),
    findByProject: async () => ok([...rows.values()]),
    findLibrary: async () => ok([]),
    delete: async () => ok(undefined),
  };
}

const audit = { records: [], record: async (r) => void audit.records.push(r) };

test("planner carries donor instructions, questions, evidence, tables, author guidance and hierarchy", async () => {
  const parent = createSection({ id: "p", title: "Results", numbering: "2", instructions: "Report against each outcome.", mandatoryQuestions: ["What changed?"], evidenceNeeded: ["Survey data"], requiredTables: [{ title: "Outcomes", columns: ["Indicator", "Target"] }], authorInstructions: "Lead with outcome 1.", pageLimit: 3 });
  const child = createSection({ id: "c", title: "Outcome 1", parentId: "p", level: 2 });
  const guidance = createSection({ id: "g", title: "How to complete", includeInReport: false });
  const planner = new InferredReportPlanner({ generate: () => "plan-1" });
  const r = await planner.plan({
    reportingPeriodId: "per-1",
    projectId: "proj-1",
    tenantId,
    templateSections: [guidance, parent, child],
    templateVersion: 3,
    profileVersion: 1,
    reportingProfileSnapshot: { tone: "FORMAL", language: "en", formattingRules: [], sectionOverrides: { p: { max: 900 } } },
  });
  assert.ok(r.ok);
  assert.deepEqual(r.value.sections.map((s) => s.title), ["Results", "Outcome 1"], "guidance-only sections never become report sections");
  const [results, outcome] = r.value.sections;
  assert.equal(results.donorInstructions, "Report against each outcome.");
  assert.deepEqual(results.mandatoryQuestions, ["What changed?"]);
  assert.deepEqual(results.evidenceNeeds, ["Survey data"]);
  assert.deepEqual(results.requiredTables, [{ title: "Outcomes", columns: ["Indicator", "Target"] }]);
  assert.equal(results.authorInstructions, "Lead with outcome 1.");
  assert.equal(results.pageLimit, 3);
  assert.equal(results.numbering, "2");
  assert.deepEqual(results.wordLimit, { min: undefined, max: 900 });
  assert.equal(outcome.parentTemplateSectionId, "p");
  assert.equal(outcome.level, 2);
});

test("toPlanSection falls back to the description when a section has no separate instructions", () => {
  const s = createSection({ title: "Summary", description: "Overview of the period." });
  assert.equal(toPlanSection(s).donorInstructions, "Overview of the period.");
  assert.equal(toPlanSection(createSection({ title: "Blank" })).donorInstructions, undefined);
});

test("template snapshot round-trips sections and requirements with its version", () => {
  const t = makeTemplate({ sections: [createSection({ id: "s1", title: "Summary", instructions: "Be brief." })], requirements: createTemplateRequirements({ generalInstructions: ["Avoid acronyms."] }), status: "REVIEWED", version: 5 });
  const snap = parseTemplateSnapshot(serializeTemplateSnapshot(t));
  assert.equal(snap.version, 5);
  assert.equal(snap.sections[0].instructions, "Be brief.");
  assert.deepEqual(snap.requirements.generalInstructions, ["Avoid acronyms."]);
  assert.equal(parseTemplateSnapshot('{"templateName":"legacy","sections":[]}'), null, "legacy unversioned snapshots are ignored");
});

test("generation context exposes report-wide donor requirements only when present", () => {
  const t = makeTemplate({ status: "REVIEWED", requirements: createTemplateRequirements({ reportTitle: "Q3 Report", generalInstructions: ["Avoid acronyms."], formatting: { rules: ["Use headings"], maxPages: 10 }, submission: { instructions: [], deadlineRule: "within 30 days" }, compliance: [{ text: "Use the logo", severity: "WARN" }], indicatorRequirements: [{ text: "Report all outcome indicators", disaggregation: ["sex", "age"] }], annexes: ["Photos"] }) });
  const c = buildTemplateGenerationContext(snapshotFromTemplate(t));
  assert.equal(c.reportTitle, "Q3 Report");
  assert.deepEqual(c.generalInstructions, ["Avoid acronyms."]);
  assert.deepEqual(c.formattingRules, ["Use headings", "The whole report must not exceed 10 pages."]);
  assert.deepEqual(c.submissionInstructions, ["Deadline: within 30 days"]);
  assert.deepEqual(c.complianceRequirements, ["Use the logo"]);
  assert.deepEqual(c.indicatorRequirements, ["Report all outcome indicators (disaggregate by: sex, age)"]);
  assert.deepEqual(c.requiredAnnexes, ["Photos"]);
  const bare = buildTemplateGenerationContext(snapshotFromTemplate(makeTemplate({ status: "REVIEWED" })));
  assert.equal("generalInstructions" in bare, false);
});

function period(over = {}) {
  return {
    donorTemplateId: "tpl-1",
    templateSnapshotJson: "{}",
    reportingProfileSnapshotJson: '{"tone":"FORMAL"}',
    setSnapshots(profile, tpl) {
      this.reportingProfileSnapshotJson = profile;
      this.templateSnapshotJson = tpl;
    },
    ...over,
  };
}

test("resolver: a full draft requires a reviewed template and pins its version on the period", async () => {
  const draftTemplate = makeTemplate({ sections: [createSection({ id: "s1", title: "Summary" })] });
  const periods = { saved: 0, update: async () => (periods.saved++, ok(undefined)) };
  const resolver = new PeriodTemplateResolver(memoryRepo([draftTemplate]), periods);
  const p = period();
  const blocked = await resolver.resolve(p, tenantId, "latest");
  assert.equal(blocked.ok, false);
  assert.equal(blocked.error.code, "REPORT_GATE_BLOCKED");

  draftTemplate.revise({ sections: draftTemplate.sections.map((s) => ({ ...s, reviewStatus: "REVIEWED" })) });
  draftTemplate.markReviewed();
  const pinned = await resolver.resolve(p, tenantId, "latest");
  assert.ok(pinned.ok);
  assert.equal(pinned.value.version, draftTemplate.version);
  assert.equal(periods.saved, 1);
  assert.equal(parseTemplateSnapshot(p.templateSnapshotJson).version, draftTemplate.version);

  await resolver.resolve(p, tenantId, "latest");
  assert.equal(periods.saved, 1, "no re-pin when the version is unchanged");
});

test("resolver: section regeneration follows the pinned snapshot even after the template changes", async () => {
  const t = makeTemplate({ sections: [createSection({ id: "s1", title: "Summary", reviewStatus: "REVIEWED" })], status: "REVIEWED" });
  const p = period({ templateSnapshotJson: serializeTemplateSnapshot(t) });
  t.revise({ sections: [createSection({ id: "s1", title: "Renamed summary", reviewStatus: "REVIEWED" })] });
  const resolver = new PeriodTemplateResolver(memoryRepo([t]), { update: async () => ok(undefined) });
  const r = await resolver.resolve(p, tenantId, "pinned");
  assert.ok(r.ok);
  assert.equal(r.value.sections[0].title, "Summary");
  assert.equal(r.value.version, 1);
});

test("upload: text-only upload starts EXTRACTING and runs extraction in the background", async () => {
  const repo = memoryRepo();
  const tasks = [];
  const extractor = {
    extract: async () =>
      ok({
        sections: [createSection({ title: "Summary", reviewStatus: "REVIEWED" })],
        requirements: createTemplateRequirements({ annexes: ["Photos"] }),
        meta: { method: "HEURISTIC", warnings: [], extractedAt: new Date().toISOString() },
        summary: "1 section",
      }),
  };
  const files = { open: async () => ({ ok: false }), save: async () => ok({}) };
  const parser = { supports: () => false, parse: async () => ok({ format: "TEXT", blocks: [] }) };
  const runner = new TemplateExtractionRunner(repo, extractor, files, parser, audit);
  const handler = new UploadTemplateHandler({ generate: () => "tpl-9" }, repo, files, runner, (task) => tasks.push(task()), audit);
  const r = await handler.handle(ctx, { projectId: "proj-1", templateName: "Q", donorName: "ECHO", reportType: "QUARTERLY", language: "en", requiredAnnexes: [], sections: [], extractedRawText: "1. Summary" });
  assert.ok(r.ok);
  assert.equal(r.value.status, "EXTRACTING");
  await Promise.all(tasks);
  const saved = repo.rows.get("tpl-9");
  assert.equal(saved.status, "NEEDS_REVIEW");
  assert.equal(saved.sections[0].reviewStatus, "DRAFT");
  assert.deepEqual(saved.requiredAnnexes, ["Photos"]);
  assert.equal(saved.version, 2);
});

test("upload: rejects empty input and cross-tenant original file keys", async () => {
  const repo = memoryRepo();
  const files = { open: async () => ({ ok: false, error: { code: "FORBIDDEN", message: "no" } }) };
  const handler = new UploadTemplateHandler({ generate: () => "x" }, repo, files, {}, () => {}, audit);
  const base = { projectId: "proj-1", templateName: "Q", donorName: "ECHO", reportType: "QUARTERLY", language: "en", requiredAnnexes: [], sections: [] };
  assert.equal((await handler.handle(ctx, base)).ok, false);
  const r = await handler.handle(ctx, { ...base, extractedRawText: "x", originalFileKey: "donor-templates/other/x.docx" });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, "FORBIDDEN");
  assert.equal(repo.rows.size, 0);
});

test("runner: extractor failure marks the template EXTRACTION_FAILED with the reason", async () => {
  const t = makeTemplate({ extractedRawText: "x" });
  const repo = memoryRepo([t]);
  const runner = new TemplateExtractionRunner(repo, { extract: async () => ({ ok: false, error: new Error("provider down") }) }, { open: async () => ({ ok: false }) }, { supports: () => false }, audit);
  await runner.run({ tenantId, actorId: "user-1", templateId: "tpl-1", mode: "replace" });
  assert.equal(repo.rows.get("tpl-1").status, "EXTRACTION_FAILED");
  assert.deepEqual(repo.rows.get("tpl-1").extractionMeta.warnings, ["provider down"]);
});

test("planHierarchy: report sections keep the template depth and numbering, with contiguous levels", async () => {
  const { planHierarchy } = await import("../dist/use-cases/reporting/generate-report-draft.js");
  const plan = [
    { templateSectionId: "t1", level: 2, numbering: "1" },
    { templateSectionId: "t2", level: 3, numbering: "1.1" },
    { templateSectionId: "t3", level: 4 },
    { templateSectionId: "t4", level: 1, numbering: "2" },
    { templateSectionId: "t5", level: 3 },
  ];
  assert.deepEqual(
    planHierarchy(plan).map((h) => [h.level, h.numbering ?? null, h.templateSectionId]),
    [
      [1, "1", "t1"],
      [2, "1.1", "t2"],
      [3, null, "t3"],
      [1, "2", "t4"],
      [2, null, "t5"],
    ],
  );
});
