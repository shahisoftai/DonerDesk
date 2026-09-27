import assert from "node:assert/strict";
import test from "node:test";
import { TenantId } from "@donordesk/domain";
import {
  HeuristicTemplateExtractor,
  LlmTemplateExtractor,
  FallbackTemplateExtractionService,
  SourceGrounding,
  splitNumbering,
} from "../dist/llm/template-extraction/index.js";
import { htmlToBlocks, linesToBlocks } from "../dist/parsers/structured/index.js";

const tenantId = TenantId.create("tenant-a");
const heuristic = new HeuristicTemplateExtractor();

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
  "3. Activities Implemented",
  "Instructions: provide a table (min 200 words, max 500 words). Activities delivered this period. Evidence needed: Activity updates, attendance sheets.",
  "[Write section content here.]",
  "",
  "4. Lessons Learned",
  "Instructions: provide a narrative (min 100 words, max 300 words). Insights and adaptations. This section is optional.",
].join("\n");

async function extractText(rawText) {
  const r = await heuristic.extract({ tenantId, rawText, language: "en" });
  assert.ok(r.ok, r.ok ? "" : r.error.message);
  return r.value;
}

test("heuristic: numbered headings with limits, evidence lists, types and optionality", async () => {
  const { sections, meta } = await extractText(ECHO_TEXT);
  assert.equal(meta.method, "HEURISTIC");
  assert.deepEqual(sections.map((s) => s.title), ["Executive Summary", "Indicator Progress", "Activities Implemented", "Lessons Learned"]);
  assert.deepEqual(sections.map((s) => s.numbering), ["1", "2", "3", "4"]);
  const [exec, indicators, activities, lessons] = sections;
  assert.equal(exec.inputType, "NARRATIVE");
  assert.equal(exec.minWords, 200);
  assert.equal(exec.maxWords, 400);
  assert.deepEqual(exec.evidenceNeeded, ["Activity summaries"]);
  assert.match(exec.instructions ?? "", /Overview of the period and headline results/);
  assert.doesNotMatch(exec.instructions ?? "", /Instructions:|provide a narrative|min 200/i);
  assert.equal(indicators.inputType, "INDICATOR_TABLE");
  assert.ok(indicators.mandatoryQuestions.some((q) => /disaggregate results by sex, age, and disability/.test(q)));
  assert.equal(activities.inputType, "TABLE");
  assert.deepEqual(activities.evidenceNeeded, ["Activity updates", "attendance sheets"]);
  assert.equal(lessons.required, false);
  assert.ok(sections.every((s) => s.reviewStatus === "DRAFT"), "extraction never marks sections reviewed");
  assert.deepEqual(sections.map((s) => s.order), [0, 1, 2, 3]);
});

test("heuristic: table-cell debris is not a heading or instruction", async () => {
  const { sections } = await extractText(ECHO_TEXT);
  const titles = sections.map((s) => s.title.toLowerCase());
  assert.ok(!titles.some((t) => t === "baseline" || t === "target" || t === "indicator"));
  assert.doesNotMatch(sections[1].instructions ?? "", /^Baseline$/m);
});

test("heuristic: nested DOCX structure → tree, questions, required tables, guidance kept out of the report", async () => {
  const html = [
    "<h1>Quarterly Progress Report Template</h1>",
    "<h1>Instructions for completing this template</h1>",
    "<p>Write for a non-specialist audience. Avoid acronyms.</p>",
    "<p>The report must be submitted within 30 days of the end of the reporting period to grants@donor.org.</p>",
    "<p>The report must not exceed 15 pages, Arial 11.</p>",
    "<h1>1. Project Overview</h1>",
    "<p>Briefly summarise the project context.</p>",
    "<h2>1.1 Changes in context</h2>",
    "<p>What changed in the operating context? Explain how the project adapted.</p>",
    "<h1>2. Results</h1>",
    "<p>Report progress against each outcome indicator. Indicators must be disaggregated by sex, age and disability.</p>",
    "<p>Table 1: Outcome indicators</p>",
    "<table><tr><td>Indicator</td><td>Baseline</td><td>Target</td><td>Achieved</td></tr><tr><td>x</td><td>1</td><td>2</td><td>3</td></tr></table>",
    "<h1>3. Safeguarding</h1>",
    "<p>Partners must report all safeguarding and PSEA incidents within 24 hours.</p>",
    "<ul><li>Describe any safeguarding concerns raised this quarter.</li></ul>",
    "<h1>Annexes</h1>",
    "<ul><li>Annex A: Beneficiary list</li><li>Annex B: Photos (optional)</li></ul>",
  ].join("");
  const r = await heuristic.extract({ tenantId, rawText: "", document: { format: "DOCX", blocks: htmlToBlocks(html) }, language: "en" });
  assert.ok(r.ok);
  const { sections, requirements } = r.value;
  const byTitle = Object.fromEntries(sections.map((s) => [s.title, s]));

  assert.equal(requirements.reportTitle, "Quarterly Progress Report");
  assert.equal(requirements.reportingFrequency, "QUARTERLY");
  assert.equal(byTitle["Instructions for completing this template"].includeInReport, false);
  assert.ok(requirements.generalInstructions.some((g) => /non-specialist audience/.test(g)));
  assert.equal(requirements.submission.deadlineOffsetDays, 30);
  assert.equal(requirements.formatting.maxPages, 15);
  assert.equal(requirements.formatting.font, "Arial 11pt");

  assert.equal(byTitle["Changes in context"].parentId, byTitle["Project Overview"].id);
  assert.equal(byTitle["Changes in context"].level, 2);
  assert.equal(byTitle["Changes in context"].numbering, "1.1");
  assert.ok(byTitle["Changes in context"].mandatoryQuestions.includes("What changed in the operating context?"));

  assert.equal(byTitle.Results.inputType, "INDICATOR_TABLE");
  assert.deepEqual(byTitle.Results.requiredTables, [{ title: "Table 1: Outcome indicators", columns: ["Indicator", "Baseline", "Target", "Achieved"] }]);
  assert.ok(requirements.indicatorRequirements.some((i) => i.disaggregation.includes("sex") && i.disaggregation.includes("disability")));

  assert.ok(requirements.compliance.some((c) => /PSEA/.test(c.text)));
  assert.ok(byTitle.Safeguarding.mandatoryQuestions.some((q) => /safeguarding concerns/.test(q)));

  const annexes = Object.fromEntries(requirements.annexes.map((a) => [a.name, a.required]));
  assert.equal(annexes["Annex A: Beneficiary list"], true);
  assert.equal(annexes["Annex B: Photos (optional)"], false);
});

test("heuristic: section/guidance table templates become sections", async () => {
  const blocks = [
    { kind: "TABLE", rows: [["Section", "Guidance", "Max length"], ["1. Summary", "Summarise results.", "300 words"], ["2. Outputs", "Describe outputs delivered.", "500 words"], ["2.1 Output 1", "Describe output 1.", ""]] },
  ];
  const r = await heuristic.extract({ tenantId, rawText: "", document: { format: "DOCX", blocks }, language: "en" });
  assert.ok(r.ok);
  const titles = r.value.sections.map((s) => s.title);
  assert.deepEqual(titles, ["Summary", "Outputs", "Output 1"]);
  assert.equal(r.value.sections[0].maxWords, 300);
  assert.equal(r.value.sections[2].parentId, r.value.sections[1].id);
});

test("heuristic: no structure → generic outline flagged as CANONICAL, never silent", async () => {
  const { sections, meta } = await extractText("plain pasted narrative without any heading structure to speak of at all");
  assert.equal(meta.method, "CANONICAL");
  assert.ok(meta.warnings.some((w) => /generic donor report outline/.test(w)));
  assert.ok(sections.some((s) => s.title === "Executive Summary"));
});

test("splitNumbering handles numeric, roman, lettered and annex labels", () => {
  assert.deepEqual(splitNumbering("2.1 Outcomes"), { numbering: "2.1", title: "Outcomes" });
  assert.deepEqual(splitNumbering("II. Background"), { numbering: "II", title: "Background" });
  assert.deepEqual(splitNumbering("Annex C: Risk register"), { numbering: "Annex C", title: "Risk register" });
  assert.deepEqual(splitNumbering("Executive Summary"), { title: "Executive Summary" });
});

test("linesToBlocks: markdown, bullets, pipe tables and wrapped PDF lines", () => {
  const blocks = linesToBlocks(
    [
      "# Report",
      "## 1. Summary",
      "This is a long wrapped line from a PDF page that continues onto the",
      "next line of the same paragraph.",
      "- first bullet",
      "| A | B |",
      "|---|---|",
      "| 1 | 2 |",
    ].map((text) => ({ text })),
  );
  assert.deepEqual(blocks.map((b) => b.kind), ["HEADING", "HEADING", "PARAGRAPH", "LIST_ITEM", "TABLE"]);
  assert.match(blocks[2].text, /continues onto the next line/);
  assert.deepEqual(blocks[4].rows, [["A", "B"], ["1", "2"]]);
});

test("SourceGrounding accepts verbatim/lightly reworded text and rejects inventions", () => {
  const g = new SourceGrounding("Describe the main achievements of the project during the reporting period, including unexpected results.");
  assert.equal(g.grounded("describe the main achievements of the project"), true);
  assert.equal(g.grounded("Describe the main achievements of the project during the period"), true);
  assert.equal(g.grounded("Explain the budget variance and co-financing arrangements"), false);
});

function fakeProvider(payload) {
  return { name: "fake", model: "fake-1", promptVersion: "1", complete: async () => ({ text: JSON.stringify(payload), model: "fake-1", promptVersion: "1", usage: { inputTokens: 1, outputTokens: 1 } }) };
}

test("LLM extractor: grounded items kept, invented sections/questions dropped with warnings", async () => {
  const rawText = [
    "1. Summary",
    "Summarise the key results of the period.",
    "2. Challenges",
    "What challenges did you face? How were they mitigated?",
    "All reports must acknowledge the donor using the official logo.",
  ].join("\n");
  const extractor = new LlmTemplateExtractor(async () =>
    fakeProvider({
      reportTitle: null,
      sections: [
        { ref: "S1", title: "Summary", numbering: "1", inputType: "NARRATIVE", required: true, includeInReport: true, instructions: "Summarise the key results of the period.", mandatoryQuestions: [], evidenceNeeded: [], requiredTables: [], quote: "1. Summary" },
        { ref: "S2", title: "Challenges", numbering: "2", inputType: "NARRATIVE", required: true, includeInReport: true, instructions: null, mandatoryQuestions: ["What challenges did you face?", "Explain the budget variance in detail."], evidenceNeeded: [], requiredTables: [], quote: "2. Challenges" },
        { ref: "S3", title: "Financial Statement of Accounts", inputType: "TABLE", required: true, includeInReport: true, mandatoryQuestions: [], evidenceNeeded: [], requiredTables: [], quote: "certified financial statement" },
      ],
      compliance: [
        { text: "All reports must acknowledge the donor using the official logo.", severity: "WARN", quote: "All reports must acknowledge the donor using the official logo." },
        { text: "Partners must hold ISO 9001 certification.", severity: "BLOCK", quote: "ISO 9001" },
      ],
    }),
  );
  const r = await extractor.extract({ tenantId, rawText, language: "en" });
  assert.ok(r.ok, r.ok ? "" : r.error.message);
  const { sections, requirements, meta } = r.value;
  assert.equal(meta.method, "LLM");
  assert.equal(meta.model, "fake-1");
  assert.deepEqual(sections.map((s) => s.title), ["Summary", "Challenges"]);
  assert.deepEqual(sections[1].mandatoryQuestions, ["What challenges did you face?"]);
  assert.deepEqual(requirements.compliance.map((c) => c.text), ["All reports must acknowledge the donor using the official logo."]);
  assert.ok(meta.warnings.some((w) => /Financial Statement of Accounts/.test(w)));
});

test("fallback chain: no AI provider → heuristic result records why", async () => {
  const chain = new FallbackTemplateExtractionService([
    { name: "AI", extractor: new LlmTemplateExtractor(async () => null) },
    { name: "Heuristic", extractor: heuristic },
  ]);
  const r = await chain.extract({ tenantId, rawText: ECHO_TEXT, language: "en" });
  assert.ok(r.ok);
  assert.equal(r.value.meta.method, "HEURISTIC");
  assert.ok(r.value.meta.warnings.some((w) => /AI extraction unavailable/.test(w)));
});
