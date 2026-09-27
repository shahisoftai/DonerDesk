import assert from "node:assert/strict";
import test from "node:test";
import {
  DonorTemplate,
  TenantId,
  createSection,
  createTemplateRequirements,
  mergeExtractedSections,
  parsePersistedRequirements,
  parsePersistedSections,
  reportableSections,
  validateSectionTree,
} from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const section = (over) => createSection({ title: "Section", ...over });

function template(over = {}) {
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

test("createSection: v2 defaults, legacy evidence string split, trimmed lists", () => {
  const s = createSection({ title: "  Results ", evidenceNeeded: "Photos; attendance sheets\nreports", mandatoryQuestions: [" What changed? ", "what changed?", ""] });
  assert.equal(s.title, "Results");
  assert.deepEqual(s.evidenceNeeded, ["Photos", "attendance sheets", "reports"]);
  assert.deepEqual(s.mandatoryQuestions, ["What changed?"]);
  assert.equal(s.level, 1);
  assert.equal(s.includeInReport, true);
  assert.equal(s.reviewStatus, "DRAFT");
  assert.equal(s.inputType, "NARRATIVE");
});

test("createSection keeps the caller's order and rejects invalid values", () => {
  assert.equal(section({ order: 7 }).order, 7);
  assert.throws(() => section({ title: "x" }), /title required/);
  assert.throws(() => section({ level: 5 }), /level/);
  assert.throws(() => section({ minWords: 50, maxWords: 10 }), /word limits/);
  assert.throws(() => section({ pageLimit: 0 }), /page limit/);
  assert.throws(() => section({ inputType: "ESSAY" }), /input type/);
});

test("parsePersistedSections keeps stored order, drops corrupt rows instead of throwing", () => {
  const { sections, dropped } = parsePersistedSections([
    { id: "b", title: "Second", order: 1, evidenceNeeded: "" },
    { id: "bad", title: "" },
    { id: "a", title: "First", order: 0, evidenceNeeded: "Docs" },
    { id: "c", title: "Orphan child", order: 2, parentId: "missing", level: 2 },
  ]);
  assert.deepEqual(sections.map((s) => s.id), ["a", "b", "c"]);
  assert.deepEqual(sections.map((s) => s.order), [0, 1, 2]);
  assert.equal(sections[2].parentId, undefined, "dangling parent detached");
  assert.equal(sections[2].level, 1);
  assert.equal(dropped.length, 1);
  assert.deepEqual(parsePersistedSections("nope").sections, []);
});

test("validateSectionTree enforces parent-before-child and one-level nesting", () => {
  const p = section({ id: "p", title: "Parent" });
  validateSectionTree([p, section({ id: "c", title: "Child", parentId: "p", level: 2 })]);
  assert.throws(() => validateSectionTree([section({ id: "c", title: "Child", parentId: "p", level: 2 }), p]), /after its parent/);
  assert.throws(() => validateSectionTree([p, section({ id: "c", title: "Child", parentId: "p", level: 3 })]), /one level below/);
  assert.throws(() => validateSectionTree([p, { ...p }]), /Duplicate/);
});

test("reportableSections excludes guidance sections and their children", () => {
  const g = section({ id: "g", title: "Instructions", includeInReport: false });
  const gc = section({ id: "gc", title: "More guidance", parentId: "g", level: 2 });
  const r = section({ id: "r", title: "Results" });
  assert.deepEqual(reportableSections([g, gc, r]).map((s) => s.id), ["r"]);
});

test("requirements: normalised, legacy annex fallback, invalid values rejected", () => {
  const req = createTemplateRequirements({ annexes: ["Photos", "photos", { name: "Budget", required: false }], compliance: [{ text: "Use the logo" }] });
  assert.deepEqual(req.annexes.map((a) => [a.name, a.required]), [["Photos", true], ["Budget", false]]);
  assert.equal(req.compliance[0].severity, "WARN");
  assert.deepEqual(parsePersistedRequirements({}, ["Annex A"]).annexes.map((a) => a.name), ["Annex A"]);
  assert.throws(() => createTemplateRequirements({ formatting: { maxPages: 0 } }), /Maximum pages/);
});

test("lifecycle: extraction → review gate → reviewed; every edit is a new version", () => {
  const t = template({ extractedRawText: "1. Summary" });
  assert.equal(t.status, "EXTRACTING");
  assert.equal(t.version, 1);
  assert.throws(() => t.revise({ sections: [] }), /still running/);

  t.applyExtraction({
    sections: [section({ id: "s1", title: "Summary", reviewStatus: "REVIEWED" }), section({ id: "s2", title: "Results" })],
    requirements: createTemplateRequirements({ annexes: ["Photos"] }),
    meta: { method: "HEURISTIC", warnings: [], extractedAt: new Date().toISOString() },
    mode: "replace",
  });
  assert.equal(t.status, "NEEDS_REVIEW");
  assert.equal(t.version, 2);
  assert.ok(t.sections.every((s) => s.reviewStatus === "DRAFT"), "extracted sections always need human review");
  assert.deepEqual(t.requiredAnnexes, ["Photos"]);
  assert.throws(() => t.markReviewed(), /still need review/);

  t.revise({ sections: t.sections.map((s) => ({ ...s, reviewStatus: "REVIEWED" })) });
  assert.equal(t.version, 3);
  t.markReviewed();
  assert.equal(t.status, "REVIEWED");
  assert.equal(t.snapshot().version, 3);
});

test("failed extraction is recoverable by authoring sections", () => {
  const t = template({ extractedRawText: "x" });
  t.failExtraction("provider down");
  assert.equal(t.status, "EXTRACTION_FAILED");
  assert.deepEqual(t.extractionMeta.warnings, ["provider down"]);
  t.revise({ sections: [section({ id: "s1", title: "Summary" })] });
  assert.equal(t.status, "NEEDS_REVIEW");
});

test("merge re-extraction keeps reviewed work, updates drafts in place, appends new sections", () => {
  const reviewed = section({ id: "keep", title: "1. Summary", instructions: "Human edited", reviewStatus: "REVIEWED" });
  const draft = section({ id: "draft", title: "Results", instructions: "old", authorInstructions: "Our guidance" });
  const manual = section({ id: "manual", title: "Our extra section" });
  const extracted = [
    section({ title: "Summary", instructions: "New wording" }),
    section({ title: "Results", instructions: "new" }),
    section({ title: "Lessons learned" }),
  ];
  const merged = mergeExtractedSections([reviewed, draft, manual], extracted);
  assert.deepEqual(merged.map((s) => s.title), ["1. Summary", "Results", "Our extra section", "Lessons learned"]);
  assert.equal(merged[0].instructions, "Human edited");
  assert.equal(merged[1].id, "draft", "id preserved so mappings survive");
  assert.equal(merged[1].instructions, "new");
  assert.equal(merged[1].authorInstructions, "Our guidance");
  assert.deepEqual(merged.map((s) => s.order), [0, 1, 2, 3]);
});

test("cloneForProject copies structure at version 1 with provenance", () => {
  const t = template({ sections: [section({ id: "s1", title: "Summary", reviewStatus: "REVIEWED" })], status: "REVIEWED", version: 4 });
  const copy = t.cloneForProject({ id: "tpl-2", projectId: "proj-2", uploadedById: "user-2" });
  assert.equal(copy.version, 1);
  assert.equal(copy.projectId, "proj-2");
  assert.equal(copy.sourceTemplateId, "tpl-1");
  assert.equal(copy.status, "REVIEWED");
  assert.deepEqual(copy.sections.map((s) => s.title), ["Summary"]);
});

test("editing an approved template back to a draft section reopens review", () => {
  const t = template({ sections: [section({ id: "s1", title: "Summary", reviewStatus: "REVIEWED" })], status: "REVIEWED" });
  t.revise({ sections: [section({ id: "s1", title: "Summary v2", reviewStatus: "REVIEWED" })] });
  assert.equal(t.status, "REVIEWED", "reviewer's own edits keep approval");
  t.revise({ sections: [section({ id: "s1", title: "Summary v3" })] });
  assert.equal(t.status, "NEEDS_REVIEW");
});
