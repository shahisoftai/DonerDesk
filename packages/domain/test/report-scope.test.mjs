import test from "node:test";
import assert from "node:assert/strict";
import { normalizeReportScope, missingScopeFields, describeReportScope, parseReportScope, checklistTemplateForReportType } from "../dist/index.js";

test("normalizeReportScope keeps only known non-empty fields and dedupes ids", () => {
  const s = normalizeReportScope({ activityIds: ["a", "a", "b", ""], eventName: "  Flood ", title: "", junk: 1 });
  assert.deepEqual(s, { activityIds: ["a", "b"], eventName: "Flood" });
});

test("missingScopeFields per report type", () => {
  assert.deepEqual(missingScopeFields("ACTIVITY", {}), ["activityIds"]);
  assert.deepEqual(missingScopeFields("ACTIVITY", { activityIds: ["a"] }), []);
  assert.deepEqual(missingScopeFields("SITUATION", { eventName: "x" }), ["situationDate"]);
  assert.deepEqual(missingScopeFields("CUSTOM", {}), ["title"]);
  assert.deepEqual(missingScopeFields("MONTHLY", {}), []);
});

test("describeReportScope names the focus; cadence reports have none", () => {
  assert.match(describeReportScope("ACTIVITY", { activityIds: ["a"] }, ["Water point repair"]), /Water point repair/);
  assert.match(describeReportScope("SITUATION", { eventName: "Flood", situationDate: "2026-10-01" }), /Flood.*2026-10-01/s);
  assert.equal(describeReportScope("MONTHLY", {}), "");
  assert.deepEqual(parseReportScope("not json"), {});
});

test("situation checklist is stricter than baseline", () => {
  assert.ok(checklistTemplateForReportType("SITUATION").items.length > checklistTemplateForReportType("CUSTOM").items.length);
});

import { blueprintSectionsFor, templateAppliesToReportType, isSynthesisSection, validateSectionTree, defaultDeadlineOffsetForType, normalizeEventName } from "../dist/index.js";

const TYPES = ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL", "FINAL", "ACTIVITY", "SITUATION", "CUSTOM"];

test("every report type has a valid built-in blueprint", () => {
  for (const reportType of TYPES) {
    const sections = blueprintSectionsFor({ reportType, scope: {}, activities: [{ id: "a1", title: "Water point repair" }] });
    assert.ok(sections.length >= 3, reportType);
    validateSectionTree(sections); // parents precede children, levels contiguous
    assert.equal(new Set(sections.map((s) => s.id)).size, sections.length, `${reportType}: unique ids`);
  }
});

test("activity blueprint: one sub-section per activity, no project-wide synthesis", () => {
  const s = blueprintSectionsFor({ reportType: "ACTIVITY", scope: {}, activities: [{ id: "a1", title: "Training" }, { id: "a2", title: "Distribution" }] });
  const items = s.filter((x) => x.level === 2);
  assert.deepEqual(items.map((x) => x.title), ["Training", "Distribution"]);
  assert.ok(items.every((x) => x.parentId === "bp:activity:details" && x.instructions.includes("Report only on")));
  assert.ok(!s.some(isSynthesisSection));
  assert.ok(s.length <= 8);
});

test("situation blueprint: first report has Background, follow-ups have Developments Since the Last Report", () => {
  const first = blueprintSectionsFor({ reportType: "SITUATION", scope: { sequence: 1 } }).map((x) => x.title);
  const next = blueprintSectionsFor({ reportType: "SITUATION", scope: { sequence: 2 } }).map((x) => x.title);
  assert.ok(first.includes("Background") && !first.includes("Developments Since the Last Report"));
  assert.ok(next.includes("Developments Since the Last Report") && !next.includes("Background"));
  assert.ok(![...first, ...next].some((t) => isSynthesisSection({ title: t })));
});

test("custom blueprint uses the author's own sections", () => {
  const s = blueprintSectionsFor({ reportType: "CUSTOM", scope: { sections: [{ title: "Donor visit", guidance: "Who came" }, { title: "Follow-ups" }] } });
  assert.deepEqual(s.map((x) => x.title), ["Donor visit", "Follow-ups"]);
});

test("templates: short ad-hoc reports only take a template of their own kind", () => {
  assert.equal(templateAppliesToReportType("ACTIVITY", "QUARTERLY"), false);
  assert.equal(templateAppliesToReportType("ACTIVITY", "ACTIVITY"), true);
  assert.equal(templateAppliesToReportType("SITUATION", undefined), false);
  assert.equal(templateAppliesToReportType("MONTHLY", "QUARTERLY"), true);
  assert.equal(templateAppliesToReportType("CUSTOM", "ANNUAL"), true);
});

test("ad-hoc deadline defaults and event-name matching", () => {
  assert.equal(defaultDeadlineOffsetForType("SITUATION"), 3);
  assert.equal(defaultDeadlineOffsetForType("ACTIVITY"), 7);
  assert.equal(defaultDeadlineOffsetForType("QUARTERLY"), undefined);
  assert.equal(normalizeEventName("  Flood   in SINDH "), "flood in sindh");
});

import { BLUEPRINT_CATALOGS, translateBlueprintText, normalizeReportLanguage, classificationTitle } from "../dist/index.js";

const ALL_TYPES = ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL", "FINAL", "ACTIVITY", "SITUATION", "CUSTOM"];
const englishTitles = () => {
  const titles = new Set(["Activity", "Total", "Male", "Female", "Children", "People with disabilities"]);
  for (const reportType of ALL_TYPES) for (const sequence of [1, 2]) {
    for (const s of blueprintSectionsFor({ reportType, scope: { sequence }, activities: [{ id: "a1", title: "Water point repair" }] })) {
      if (!s.id.includes(":item:")) titles.add(s.canonicalTitle ?? s.title);
    }
  }
  return titles;
};

test("every blueprint title and table header is translated in every report language", () => {
  for (const [lang, catalog] of Object.entries(BLUEPRINT_CATALOGS)) {
    for (const title of englishTitles()) assert.ok(catalog[title], `${lang}: missing "${title}"`);
  }
});

test("no canonical blueprint title trips the AI worker's executive-summary classifier", () => {
  for (const t of englishTitles()) assert.ok(!/overview|abstract/i.test(t), t);
});

test("translated blueprint: display title translated, canonical title English, activity titles as written", () => {
  const fr = blueprintSectionsFor({ reportType: "ACTIVITY", scope: {}, language: "fr", activities: [{ id: "a1", title: "Water point repair" }] });
  assert.equal(fr[0].title, "Introduction");
  assert.equal(fr.find((s) => s.id === "bp:activity:next").title, "Prochaines étapes");
  assert.equal(fr.find((s) => s.id === "bp:activity:next").canonicalTitle, "Next Steps");
  assert.equal(fr.find((s) => s.id === "bp:activity:item:a1").title, "Water point repair");
  const ar = blueprintSectionsFor({ reportType: "QUARTERLY", scope: {}, language: "ar" });
  const exec = ar.find((s) => s.id === "bp:quarterly:exec");
  assert.equal(exec.title, "الملخص التنفيذي");
  assert.equal(classificationTitle(exec), "Executive Summary");
  assert.ok(isSynthesisSection(exec), "a translated executive summary is still drafted last");
  assert.ok(isSynthesisSection({ title: "Résumé analytique", templateSectionId: "bp:annual:exec" }), "persisted sections are recognised by their blueprint id");
  assert.ok(!isSynthesisSection({ title: "Prochaines étapes", templateSectionId: "bp:activity:next" }));
});

test("report language normalisation", () => {
  assert.equal(normalizeReportLanguage("FR"), "fr");
  assert.equal(normalizeReportLanguage("fr-FR"), "fr");
  assert.equal(normalizeReportLanguage("Urdu"), "ur");
  assert.equal(normalizeReportLanguage("de"), "en");
  assert.equal(normalizeReportLanguage(undefined), "en");
  assert.equal(translateBlueprintText("Next Steps", "ps"), "راتلونکي ګامونه");
  assert.equal(translateBlueprintText("Not in catalog", "fr"), "Not in catalog");
});
