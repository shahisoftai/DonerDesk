import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import { TenantId } from "@donordesk/domain";
import { SourceGrounding, TocTemplateExtractor, renderOutlineView, validateToc } from "../dist/llm/template-extraction/index.js";
import { CompositeStructuredDocumentParser, assignLevelsFromStyle } from "../dist/parsers/structured/index.js";

const tenantId = TenantId.create("tenant-a");

// A quarterly-report template shaped like the real USAID QPR: a TOC with page
// numbers, a guidance part, table captions, and four levels of headings.
const BLOCKS = [
  { kind: "PARAGRAPH", text: "CONTENTS" },
  { kind: "HEADING", level: 1, text: "ACTIVITY IMPLEMENTATION 7" },
  { kind: "HEADING", level: 1, text: "1. GUIDE FOR IMPLEMENTING PARTNERS" },
  { kind: "PARAGRAPH", text: "This guide explains how to complete the template. Reports are due 30 days after the end of each quarter." },
  { kind: "HEADING", level: 1, text: "2. ACTIVITY IMPLEMENTATION" },
  { kind: "PARAGRAPH", text: "Describe progress for the quarter." },
  { kind: "HEADING", level: 1, text: "PROGRESS NARRATIVE" },
  { kind: "PARAGRAPH", text: "Summarise progress against each result. What were the main achievements?" },
  { kind: "HEADING", level: 1, text: "RESULT 1 PROGRESS" },
  { kind: "PARAGRAPH", text: "Report on result 1." },
  { kind: "HEADING", level: 1, text: "SUB-RESULT 1.1" },
  { kind: "PARAGRAPH", text: "Report on sub-result 1.1 in no more than 300 words." },
  { kind: "HEADING", level: 1, text: "TABLE 1: ACTIVITIES" },
  { kind: "TABLE", rows: [["Activity", "Status", "Comments"], ["", "", ""]] },
  { kind: "HEADING", level: 1, text: "3. ANNEXES" },
  { kind: "HEADING", level: 1, text: "ANNEX I SUCCESS STORIES" },
  { kind: "PARAGRAPH", text: "Attach one success story per quarter." },
];

function tocResponse() {
  return {
    reportTitle: null,
    reportingFrequency: "QUARTERLY",
    toc: [
      // Out of order, a skipped level, a duplicate block and an invented entry.
      { block: 4, level: 1, numbering: "2", title: "Activity Implementation", contentType: "NARRATIVE", includeInReport: true },
      { block: 2, level: 1, numbering: "1", title: "Guide for Implementing Partners", contentType: "NARRATIVE", includeInReport: false },
      { block: 6, level: 3, numbering: null, title: "Progress Narrative", contentType: "NARRATIVE", includeInReport: true },
      { block: 8, level: 3, numbering: null, title: "Result 1 Progress", contentType: "NARRATIVE", includeInReport: true },
      { block: 10, level: 4, numbering: null, title: "Sub-Result 1.1", contentType: "NARRATIVE", includeInReport: true },
      { block: 10, level: 2, numbering: null, title: "Duplicate", contentType: "NARRATIVE", includeInReport: true },
      { block: 14, level: 1, numbering: "3", title: "Annexes", contentType: "ANNEX", includeInReport: true },
      { block: 15, level: 2, numbering: "Annex I", title: "Success Stories", contentType: "ANNEX", includeInReport: true },
      { block: 16, level: 2, numbering: null, title: "Budget Variance Analysis", contentType: "TABLE", includeInReport: true },
    ],
  };
}

function detailResponse(ids) {
  const all = {
    b2: { id: "b2", summary: "Guidance only.", inputType: "NARRATIVE", required: true, instructions: null, mandatoryQuestions: [], evidenceNeeded: [], requiredTables: [] },
    b4: { id: "b4", summary: "Narrative overview of progress this quarter.", inputType: "NARRATIVE", required: true, instructions: "Describe progress for the quarter.", mandatoryQuestions: [], evidenceNeeded: [], requiredTables: [] },
    b6: {
      id: "b6",
      summary: "Narrative: progress against each result.",
      inputType: "NARRATIVE",
      required: true,
      instructions: "Summarise progress against each result.",
      mandatoryQuestions: ["What were the main achievements?", "Explain the budget variance."],
      evidenceNeeded: [],
      requiredTables: [],
    },
    b8: { id: "b8", summary: "Narrative on result 1.", inputType: "NARRATIVE", required: true, instructions: "Report on result 1.", mandatoryQuestions: [], evidenceNeeded: [], requiredTables: [] },
    b10: {
      id: "b10",
      summary: "Narrative, max 300 words; include Table 1.",
      inputType: "NARRATIVE",
      required: true,
      instructions: "Report on sub-result 1.1 in no more than 300 words.",
      mandatoryQuestions: [],
      evidenceNeeded: [],
      requiredTables: [{ title: "Table 1: Activities", columns: ["Activity", "Status", "Comments"] }],
      maxWords: 300,
    },
    b14: { id: "b14", summary: null, inputType: "ANNEX", required: true, instructions: null, mandatoryQuestions: [], evidenceNeeded: [], requiredTables: [] },
    b15: { id: "b15", summary: "Attach one success story.", inputType: "ANNEX", required: true, instructions: "Attach one success story per quarter.", mandatoryQuestions: [], evidenceNeeded: [], requiredTables: [] },
  };
  return {
    sections: ids.map((id) => all[id]).filter(Boolean),
    submission: { instructions: [{ text: "Reports are due 30 days after the end of each quarter.", quote: "Reports are due 30 days after the end of each quarter." }] },
  };
}

/** Answers the outline prompt with the TOC and each detail prompt with its listed ids. */
function scriptedProvider({ failDetails = false } = {}) {
  const calls = [];
  return {
    calls,
    provider: {
      name: "fake",
      model: "fake-2",
      promptVersion: "1",
      complete: async ({ systemPrompt, userPrompt }) => {
        calls.push({ systemPrompt, userPrompt });
        let payload;
        if (/Table of Contents/.test(systemPrompt)) payload = tocResponse();
        else if (failDetails) throw new Error("upstream timeout");
        else payload = detailResponse((/Sections to fill: (.*)/.exec(userPrompt)?.[1] ?? "").split(", ").filter(Boolean));
        return { text: JSON.stringify(payload), model: "fake-2", promptVersion: "1", usage: { inputTokens: 1, outputTokens: 1 } };
      },
    },
  };
}

const request = { tenantId, rawText: "", document: { format: "DOCX", blocks: BLOCKS }, language: "en" };

test("toc v2: outline pass decides structure (4 levels, document order, no skipped level, invented entries dropped)", async () => {
  const { provider, calls } = scriptedProvider();
  const r = await new TocTemplateExtractor(async () => provider).extract(request);
  assert.ok(r.ok, r.ok ? "" : r.error.message);
  const { sections, meta, requirements } = r.value;
  assert.equal(meta.promptVersion, "template-extract-v2");
  assert.deepEqual(
    sections.map((s) => [s.level, s.title]),
    [
      [1, "Guide for Implementing Partners"],
      [1, "Activity Implementation"],
      [2, "Progress Narrative"],
      [3, "Result 1 Progress"],
      [4, "Sub-Result 1.1"],
      [1, "Annexes"],
      [2, "Success Stories"],
    ],
  );
  assert.equal(sections[0].includeInReport, false);
  const byTitle = Object.fromEntries(sections.map((s) => [s.title, s]));
  assert.equal(byTitle["Sub-Result 1.1"].parentId, byTitle["Result 1 Progress"].id);
  assert.equal(byTitle["Success Stories"].numbering, "Annex I");
  assert.ok(meta.warnings.some((w) => /Budget Variance Analysis/.test(w)));
  // The whole document went to the outline pass in one call; the TOC line is there for the model to skip.
  assert.match(calls[0].userPrompt, /\[1\] H1 ACTIVITY IMPLEMENTATION 7/);
  assert.equal(requirements.submission.instructions.length, 1);
});

test("toc v2: guidance lands in each section's fields; ungrounded questions dropped", async () => {
  const { provider } = scriptedProvider();
  const r = await new TocTemplateExtractor(async () => provider).extract(request);
  assert.ok(r.ok);
  const byTitle = Object.fromEntries(r.value.sections.map((s) => [s.title, s]));
  assert.equal(byTitle["Sub-Result 1.1"].description, "Narrative, max 300 words; include Table 1.");
  assert.equal(byTitle["Sub-Result 1.1"].maxWords, 300);
  assert.deepEqual(byTitle["Sub-Result 1.1"].requiredTables[0].columns, ["Activity", "Status", "Comments"]);
  assert.deepEqual(byTitle["Progress Narrative"].mandatoryQuestions, ["What were the main achievements?"]);
  assert.equal(byTitle["Progress Narrative"].instructions, "Summarise progress against each result.");
  assert.equal(byTitle["Progress Narrative"].source.excerpt, "PROGRESS NARRATIVE");
});

test("toc v2: a failed guidance call keeps the AI outline and reads guidance without AI", async () => {
  const { provider } = scriptedProvider({ failDetails: true });
  const r = await new TocTemplateExtractor(async () => provider).extract(request);
  assert.ok(r.ok, r.ok ? "" : r.error.message);
  assert.equal(r.value.sections.length, 7);
  assert.ok(r.value.meta.warnings.some((w) => /guidance extraction failed/.test(w)));
  const sub = r.value.sections.find((s) => s.title === "Sub-Result 1.1");
  assert.equal(sub.maxWords, 300);
});

test("toc v2: no provider → error so the fallback chain can use the heuristic extractor", async () => {
  const r = await new TocTemplateExtractor(async () => null).extract(request);
  assert.equal(r.ok, false);
});

test("validateToc falls back to the printed heading when the model rewrites a title", () => {
  const blocks = [{ kind: "HEADING", level: 1, text: "4. SUSTAINABILITY AND EXIT STRATEGY" }];
  const warnings = [];
  const g = new SourceGrounding(blocks[0].text);
  const [e] = validateToc({ toc: [{ block: 0, level: 2, title: "Long-term Plans After Funding Ends", contentType: "NARRATIVE" }] }, blocks, g, warnings);
  assert.equal(e.title, "SUSTAINABILITY AND EXIT STRATEGY");
  assert.equal(e.level, 1);
});

test("renderOutlineView keeps headings with formatting and shrinks to budget", () => {
  const blocks = [
    { kind: "HEADING", level: 1, text: "1. Results", style: { key: "k", size: 14, bold: true, color: "C21139" } },
    ...Array.from({ length: 50 }, (_, i) => ({ kind: "PARAGRAPH", text: `Paragraph ${i} `.repeat(30) })),
    ...Array.from({ length: 8 }, (_, i) => ({ kind: "LIST_ITEM", text: `item ${i}`, ordered: false, depth: 0 })),
  ];
  const full = renderOutlineView(blocks);
  assert.match(full, /\[0\] H1 1\. Results \{14pt bold #C21139\}/);
  assert.equal((full.match(/item \d/g) ?? []).length, 2);
  const small = renderOutlineView(blocks, 500);
  assert.ok(small.length <= 500);
  assert.match(small, /H1 1\. Results/);
});

test("assignLevelsFromStyle: nesting follows prominence; captions nest; styled-heading documents untouched", () => {
  const L1 = { key: "a", size: 14, bold: true, color: "C21139" };
  const L2 = { key: "b", size: 10, bold: true };
  const L3 = { key: "c", size: 10, color: "C21139" };
  const odd = { key: "d", size: 11, color: "6C6362" };
  const h = (text, style) => ({ kind: "HEADING", level: 1, text, style });
  const out = assignLevelsFromStyle([
    h("1. ACRONYMS", L1),
    h("USAID", odd),
    h("2. COLLABORATION", L1),
    h("WITH OTHER ACTIVITIES", L2),
    h("KEY HIGHLIGHTS", L3),
    h("TABLE 2: PLANNED", { key: "e", size: 12, color: "002A6C" }),
    h("CHALLENGES", L3),
    h("WITH HOST GOVERNMENT", L2),
    h("3. ANNEXES", L1),
  ]);
  assert.deepEqual(
    out.map((b) => b.level),
    [1, 2, 1, 2, 3, 4, 3, 2, 1],
  );
  const styled = [
    { kind: "HEADING", level: 1, text: "A", style: L1 },
    { kind: "HEADING", level: 2, text: "B", style: L2 },
    { kind: "HEADING", level: 2, text: "C", style: L3 },
  ];
  assert.deepEqual(assignLevelsFromStyle(styled), styled);
});

async function docx(paragraphs) {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  zip.file(
    "_rels/.rels",
    '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  const body = paragraphs
    .map(([text, rPr]) => `<w:p><w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ""}<w:t xml:space="preserve">${text}</w:t></w:r></w:p>`)
    .join("");
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`);
  return zip.generateAsync({ type: "nodebuffer" });
}

test("DOCX without heading styles: levels recovered from run formatting", async () => {
  const big = '<w:b/><w:color w:val="C21139"/><w:sz w:val="28"/>';
  const mid = '<w:b/><w:color w:val="000000"/><w:sz w:val="20"/>';
  const small = '<w:color w:val="C21139"/><w:sz w:val="20"/>';
  const buffer = await docx([
    ["1. ACTIVITY IMPLEMENTATION", big],
    ["PROGRESS NARRATIVE", mid],
    ["Describe progress against each result this quarter.", '<w:sz w:val="20"/>'],
    ["1. KEY HIGHLIGHTS OF THE COLLABORATION", small],
    ["2. CHALLENGES OF THE COLLABORATION", small],
    ["2. SUSTAINABILITY AND EXIT STRATEGY", big],
  ]);
  const r = await new CompositeStructuredDocumentParser().parse({ buffer, fileName: "t.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  assert.ok(r.ok, r.ok ? "" : r.error.message);
  const headings = r.value.blocks.filter((b) => b.kind === "HEADING").map((b) => [b.level, b.text]);
  assert.deepEqual(headings, [
    [1, "1. ACTIVITY IMPLEMENTATION"],
    [2, "PROGRESS NARRATIVE"],
    [3, "1. KEY HIGHLIGHTS OF THE COLLABORATION"],
    [3, "2. CHALLENGES OF THE COLLABORATION"],
    [1, "2. SUSTAINABILITY AND EXIT STRATEGY"],
  ]);
});
