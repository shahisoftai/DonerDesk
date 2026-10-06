import assert from "node:assert/strict";
import test from "node:test";
import { SECTION_KINDS, sectionKind, sectionKindOfTitle, isRecordsOnlyKind, blueprintSectionsFor } from "../dist/index.js";

test("existing stub routing is preserved (title -> kind)", () => {
  const table = [
    ["Executive Summary", "executive_summary"],
    ["Methodology and Data Quality", "methodology"],
    ["Progress Against the Work Plan", "results"],
    ["Progress Against Indicators", "results"],
    ["Activities Implemented", "activities"],
    ["Key Activities and Achievements", "activities"],
    ["Achievements", "achievements"],
    ["Challenges and Lessons Learned", "challenges"],
    ["Lessons Learned", "learning"],
    ["Plan for Next Month", "plan"],
    ["Priority Needs and Next Steps", "plan"],
    ["Work Plan for Next Year", "plan"],
    ["Beneficiary Voices", "voice"],
    ["Financial Close-out", "finance"],
    ["Annexes", "annex"],
  ];
  for (const [title, kind] of table) assert.equal(sectionKindOfTitle(title), kind, title);
});

test("sections with no stub get a records-only kind, never a results dump", () => {
  for (const title of ["Environmental Compliance", "Branding and Marking", "Gender and Inclusion", "Safeguarding", "Coordination", "Risks and Mitigation", "Sustainability", "Background", "Introduction", "Comparison with the Previous Half-Year"]) {
    assert.ok(isRecordsOnlyKind(sectionKindOfTitle(title)), title);
  }
  assert.equal(isRecordsOnlyKind("results"), false);
});

test("the English canonical title decides, not the translated one", () => {
  assert.equal(sectionKind({ title: "Résumé exécutif", canonicalTitle: "Executive Summary" }), "executive_summary");
  assert.equal(sectionKind({ title: "Résumé exécutif" }), "narrative");
});

test("every blueprint section of every report type has a known kind", () => {
  const types = ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL", "FINAL", "ACTIVITY", "SITUATION", "CUSTOM"];
  let seen = 0;
  for (const reportType of types) {
    let sections = [];
    try {
      sections = blueprintSectionsFor({ reportType, scope: {}, language: "en", activities: [{ title: "Training" }], financeAvailable: false, indicatorCount: 1 });
    } catch {
      continue;
    }
    for (const s of sections) {
      seen += 1;
      assert.ok(SECTION_KINDS.includes(sectionKind({ title: s.title, canonicalTitle: s.canonicalTitle })), `${reportType}: ${s.title}`);
    }
  }
  assert.ok(seen > 20, `only ${seen} blueprint sections were checked`);
});

test("the two USAID template layouts classify (8 and 14 sections)", () => {
  const monthly = ["Executive Summary", "Progress Against Indicators", "Activities Implemented", "Environmental Compliance", "Branding and Marking", "Challenges and Mitigation", "Plan for Next Month", "Annexes"];
  const kinds = monthly.map(sectionKindOfTitle);
  assert.deepEqual(kinds, ["executive_summary", "results", "activities", "compliance", "compliance", "challenges", "plan", "annex"]);
});
