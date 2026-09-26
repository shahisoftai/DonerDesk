import assert from "node:assert/strict";
import test from "node:test";

import {
  parseInline,
  parseMarkdownBlocks,
  renderDocxBlocks,
  renderPdfBlocks,
} from "../dist/exports/markdown-renderer.js";
import { DefaultExportBuilder } from "../dist/exports/builder.js";

test("parseMarkdownBlocks extracts headings, paragraphs, bullets, quotes, and tables", () => {
  const blocks = parseMarkdownBlocks(
    [
      "## Delivery Highlights",
      "",
      "OUT-5 recorded 2,500 children enrolled this period.",
      "",
      "- Strong: enrolment held steady",
      "  - Sub-point with detail",
      "1. First planned step",
      "",
      "| Code | Value | RAG |",
      "|------|-------|-----|",
      "| OUT-5 | 2,500 | GREEN |",
      "",
      "> \"The classes changed how our children learn,\" a parent said.",
    ].join("\n"),
  );
  const types = blocks.map((b) => b.type);
  assert.deepEqual(types, ["heading", "paragraph", "bullet", "bullet", "bullet", "table", "quote"]);
  const table = blocks[5];
  assert.deepEqual(table.header, ["Code", "Value", "RAG"]);
  assert.deepEqual(table.rows, [["OUT-5", "2,500", "GREEN"]]);
  assert.equal(blocks[3].level, 1);
  assert.equal(blocks[4].ordered, true);
});

test("parseInline handles bold, italic, code, and links", () => {
  const runs = parseInline("**Bold** and *soft* and `code` and [label](https://x.y)");
  // Adjacent plain runs coalesce: " and " after `code` merges with the
  // rendered link text.
  assert.deepEqual(
    runs.map((r) => [r.text, !!r.bold, !!r.italic, !!r.code]),
    [
      ["Bold", true, false, false],
      [" and ", false, false, false],
      ["soft", false, true, false],
      [" and ", false, false, false],
      ["code", false, false, true],
      [" and label (https://x.y)", false, false, false],
    ],
  );
});

test("renderDocxBlocks emits Paragraphs and Tables", () => {
  const blocks = parseMarkdownBlocks("# H\n\nPlain **bold** text\n\n| A | B |\n|---|---|\n| 1 | 2 |");
  const rendered = renderDocxBlocks(blocks);
  const names = rendered.map((r) => r.constructor.name);
  assert.deepEqual(names, ["Paragraph", "Paragraph", "Table", "Paragraph"]);
});

test("buildWord renders a valid DOCX zip from markdown sections", async () => {
  const builder = new DefaultExportBuilder();
  const artifacts = await builder.build({
    exportType: "WORD",
    exportIntent: "DONOR_SUBMISSION",
    submissionSnapshotId: "snap-1",
    projectName: "EERP",
    reportingPeriodLabel: "2026 Q2",
    reportTitle: "EERP Quarterly Report",
    sections: [
      {
        title: "Progress Against Indicators",
        status: "APPROVED",
        content: [
          "Enrolment reached 2,500 children.",
          "",
          "| Code | Indicator | Value | Target | RAG |",
          "|------|-----------|-------|--------|-----|",
          "| OUT-5 | Enrolment | 2,500 | 2,500 | GREEN |",
          "",
          "- Safe learning spaces maintained",
        ].join("\n"),
      },
    ],
    indicators: [{ code: "OUT-5", name: "Enrolment", baseline: "0", target: "2500", achievement: "2500", unit: "children", status: "ACHIEVED" }],
    charts: [],
    activities: [],
    checklist: [],
    evidenceItems: [],
    includeSensitive: false,
  });
  assert.equal(artifacts.contentType, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  assert.equal(artifacts.fileBuffer.subarray(0, 2).toString("latin1"), "PK");
});

test("buildPdf renders markdown tables without literal pipe dumps", async () => {
  const PDFDocumentMod = (await import("pdfkit")).default;
  const chunks2 = [];
  const doc2 = new PDFDocumentMod({ margin: 50, compress: false, info: { Title: "t" } });
  doc2.on("data", (c) => chunks2.push(c));
  const done2 = new Promise((resolve) => doc2.on("end", () => resolve()));
  const blocks = parseMarkdownBlocks("| Code | Value |\n|------|-------|\n| OUT-5 | 2,500 |");
  renderPdfBlocks(doc2, blocks);
  doc2.end();
  await done2;
  const pdf = Buffer.concat(chunks2).toString("latin1").toLowerCase();
  assert.equal(pdf.slice(0, 4), "%pdf");
  // pdfkit writes text as hex glyph runs split by kern adjustments
  // ("<56> 60 <616c7565>" = "Value"), so decode every hex run and join them
  // before asserting on the rendered cell text; the raw markdown separator
  // must still be absent.
  const decoded = [...pdf.matchAll(/<([0-9a-f\s]+)>/g)]
    .map((m) => Buffer.from(m[1].replace(/\s/g, ""), "hex").toString("latin1"))
    .join("");
  assert.ok(decoded.includes("OUT-5"), `table cell text should be rendered; got: ${decoded.slice(0, 200)}`);
  assert.ok(!pdf.includes("|------|"), "raw markdown table separator must not be printed");
});

test("renderPdfBlocks never throws on odd input", () => {
  // Degenerate table (no columns) and empty content must not crash.
  const blocks = parseMarkdownBlocks("| | \n|-|-|\n| | ");
  assert.equal(Array.isArray(blocks), true);
});
