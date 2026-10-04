import test from "node:test";
import assert from "node:assert/strict";
import { periodComparability, comparableReportTypes, selectComparablePeriods, sectionMatchKeys, normalizeReportScope, missingScopeFields, describeReportScope, parseReportScope, checklistTemplateForReportType } from "../dist/index.js";

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

test("periodComparability: a report is only compared with its own kind", () => {
  assert.deepEqual(periodComparability("QUARTERLY", {})?.primary, ["QUARTERLY"]);
  assert.equal(periodComparability("ACTIVITY", {}), null);
  assert.equal(periodComparability("CUSTOM", {}), null);
  assert.equal(periodComparability("SITUATION", { eventName: " Flood  X " })?.eventKey, "flood x");
  assert.deepEqual(comparableReportTypes(periodComparability("SEMI_ANNUAL", {})), ["SEMI_ANNUAL", "QUARTERLY"]);
});

test("selectComparablePeriods: primary wins, fallback is capped", () => {
  const c = periodComparability("SEMI_ANNUAL", {});
  const q = (id) => ({ id, reportType: "QUARTERLY" });
  assert.deepEqual(selectComparablePeriods([q("a"), q("b"), q("c")], c, 4).map((p) => p.id), ["a", "b"]);
  assert.deepEqual(selectComparablePeriods([q("a"), { id: "h", reportType: "SEMI_ANNUAL" }], c, 4).map((p) => p.id), ["h"]);
  assert.deepEqual(selectComparablePeriods([{ id: "m", reportType: "MONTHLY" }], c, 4), []);
});

test("sectionMatchKeys: blueprint key is language- and type-independent", () => {
  assert.deepEqual(sectionMatchKeys({ templateSectionId: "bp:quarterly:exec", title: "Résumé" }), ["bp:exec", "title:résumé"]);
  assert.deepEqual(sectionMatchKeys({ templateSectionId: "bp:semi_annual:exec", canonicalTitle: "Executive Summary", title: "Résumé" }).slice(0, 1), ["bp:exec"]);
  assert.deepEqual(sectionMatchKeys({ templateSectionId: "tpl-9", sectionTitle: "2.1  Results" }), ["id:tpl-9", "title:results"]);
});

test("every cadence blueprint section tells the writer what to do", () => {
  for (const reportType of ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL", "FINAL"]) {
    const sections = blueprintSectionsFor({ reportType, scope: {} });
    assert.ok(sections.length >= 6, reportType);
    for (const s of sections) {
      if (s.inputType === "ANNEX") continue;
      assert.notEqual(s.instructions, s.description, `${reportType}/${s.title} only has a description`);
      assert.match(s.instructions ?? "", /not reported|supplied|recorded|Never estimate/i, `${reportType}/${s.title} lacks a no-invention rule`);
    }
    assert.ok(!sections.some((s) => /overview|abstract/i.test(s.title)), `${reportType} has a title the worker reads as an executive summary`);
  }
});

test("narrative cadence sections ask the writer to answer questions; tables and annexes do not", () => {
  const annual = blueprintSectionsFor({ reportType: "ANNUAL", scope: {} });
  const by = (id) => annual.find((s) => s.id === `bp:annual:${id}`);
  assert.ok(by("cumulative").mandatoryQuestions.length > 0);
  assert.equal(by("results").mandatoryQuestions.length, 0);
  assert.equal(by("annexes").mandatoryQuestions.length, 0);
});

test("annual and final blueprints ask for cumulative figures; quarterly does not", () => {
  const text = (type) => blueprintSectionsFor({ reportType: type, scope: {} }).map((s) => s.instructions).join(" ");
  assert.match(text("ANNUAL"), /cumulative/i);
  assert.match(text("FINAL"), /life-of-project/i);
  assert.doesNotMatch(text("QUARTERLY"), /life-of-project/i);
});

import { sectionPredecessorKeys } from "../dist/index.js";

test("normalizeReportScope keeps valid affected-population figures and needs, trimmed and capped", () => {
  const s = normalizeReportScope({
    affectedPopulation: [
      { group: " Displaced households ", figure: " 1,200 ", source: "OCHA", asOf: "2028-05-06", junk: 1 },
      { group: "no figure" },
      { figure: "5" },
      "x",
    ],
    needs: [" Clean water ", "", 5],
  });
  assert.deepEqual(s.affectedPopulation, [{ group: "Displaced households", figure: "1,200", source: "OCHA", asOf: "2028-05-06" }]);
  assert.deepEqual(s.needs, ["Clean water"]);
  assert.deepEqual(normalizeReportScope({ affectedPopulation: [], needs: [] }), {});
});

test("describeReportScope quotes the figures and the previous report's for comparison", () => {
  const scope = { eventName: "Flood", situationDate: "2028-05-06", sequence: 2, affectedPopulation: [{ group: "Households", figure: "1,500", source: "OCHA" }], needs: ["Water", "Shelter"] };
  const previous = { situationDate: "2028-05-01", affectedPopulation: [{ group: "Households", figure: "1,200" }] };
  const text = describeReportScope("SITUATION", scope, [], previous);
  assert.match(text, /Households: 1,500 \(source: OCHA\)/);
  assert.match(text, /Needs reported: Water; Shelter/);
  assert.match(text, /previous report \(as of 2028-05-01\): Households: 1,200/);
  assert.doesNotMatch(describeReportScope("SITUATION", { eventName: "Flood" }), /Affected population/);
});

test("a follow-up's 'changes' section looks for the previous report's at-a-glance, and not the reverse", () => {
  assert.deepEqual(sectionPredecessorKeys({ templateSectionId: "bp:situation:changes", title: "Developments" }), ["bp:changes", "bp:overview", "title:developments"]);
  assert.deepEqual(sectionPredecessorKeys({ templateSectionId: "bp:situation:overview", title: "At a Glance" }), ["bp:overview", "title:at a glance"]);
});
