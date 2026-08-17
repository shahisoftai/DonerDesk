import assert from "node:assert/strict";
import test from "node:test";
import { StubTemplateExtractionService } from "../dist/llm/template-extraction.js";

const extraction = new StubTemplateExtractionService();

const ECHO_TEXT = [
  "EU ECHO Narrative Report",
  "Reporting period: ______  Project: ______",
  "",
  "1. Executive Summary",
  "Instructions: provide a narrative (min 200 words, max 400 words). Overview of the period and headline results. Evidence needed: Activity summaries.",
  "[Write section content here. Claims must be supported by verified evidence.]",
  "",
  "2. Indicator Progress",
  "Instructions: provide an indicator table (min 100 words, max 300 words). Indicator achievements versus baselines and targets. Evidence needed: Verified indicator data. Include a data table with baseline, target, and actuals; disaggregate results by sex, age, and disability where applicable.",
  "Indicator",
  "",
  "Baseline",
  "",
  "Target",
  "",
  "Actual",
  "",
  "3. Activities Implemented",
  "Instructions: provide a table (min 200 words, max 500 words). Activities delivered this period. Evidence needed: Activity updates, attendance sheets.",
  "[Write section content here.]",
  "",
  "4. Lessons Learned",
  "Instructions: provide a narrative (min 100 words, max 300 words). Insights and adaptations. This section is optional.",
].join("\n");

test("extracts numbered headings with word limits, evidence, and types", async () => {
  const result = await extraction.extractSections({ rawText: ECHO_TEXT, language: "en" });
  assert.equal(result.sections.length, 4);

  const [exec, indicators, activities, lessons] = result.sections;
  assert.equal(exec?.title, "Executive Summary");
  assert.equal(exec?.inputType, "NARRATIVE");
  assert.equal(exec?.minWords, 200);
  assert.equal(exec?.maxWords, 400);
  assert.equal(exec?.evidenceNeeded, "Activity summaries");
  assert.equal(exec?.required, true);

  assert.equal(indicators?.title, "Indicator Progress");
  assert.equal(indicators?.inputType, "INDICATOR_TABLE");
  assert.equal(indicators?.evidenceNeeded, "Verified indicator data");

  assert.equal(activities?.title, "Activities Implemented");
  assert.equal(activities?.inputType, "TABLE");

  assert.equal(lessons?.title, "Lessons Learned");
  assert.equal(lessons?.required, false, "optional guidance marks the section optional");
});

test("table cells like Item/Indicator are not detected as headings", async () => {
  const result = await extraction.extractSections({ rawText: ECHO_TEXT, language: "en" });
  const titles = result.sections.map((s) => s.title.toLowerCase());
  assert.ok(!titles.includes("item"));
  assert.ok(!titles.includes("indicator") || titles.includes("indicator progress"));
  assert.ok(!titles.some((t) => t === "baseline" || t === "target" || t === "actual"));
});

test("long guidance lines are preserved in descriptions", async () => {
  const result = await extraction.extractSections({ rawText: ECHO_TEXT, language: "en" });
  const indicators = result.sections.find((s) => s.title === "Indicator Progress");
  assert.ok(indicators?.description.includes("baseline, target, and actuals"));
  assert.ok(indicators?.description.includes("disaggregate"));
});

test("falls back to canonical outline when no headings are detected", async () => {
  const result = await extraction.extractSections({ rawText: "plain pasted narrative without any heading structure to speak of at all", language: "en" });
  assert.ok(result.sections.length >= 5);
  assert.ok(result.sections.some((s) => s.title === "Executive Summary"));
});

test("keeps existing sections when regenerating", async () => {
  const existing = [
    { id: "s1", title: "My Section", description: "Keep me", inputType: "NARRATIVE", required: true, evidenceNeeded: "Docs", reviewStatus: "REVIEWED", order: 0 },
  ];
  const result = await extraction.extractSections({ rawText: ECHO_TEXT, language: "en", existingSections: existing });
  assert.equal(result.sections.length, 1);
  assert.equal(result.sections[0]?.title, "My Section");
  assert.equal(result.sections[0]?.description, "Keep me");
});
