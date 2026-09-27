import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, createWriteStream, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import PDFDocument from "pdfkit";
import { PdfBlockReader } from "../dist/parsers/structured/readers.js";

// pdfkit's default (compressed) stream output trips a "bad XRef entry" error
// in this pdf-parse version's bundled pdf.js — unrelated to the fix under
// test, so fixtures here are built uncompressed, which every real-world PDF
// producer also supports. Written to a real file (piping to a write stream)
// rather than collected from "data"/"end" chunks, which produced a subtly
// truncated buffer.
function buildPdf(lines) {
  const dir = mkdtempSync(join(tmpdir(), "dd-pdf-test-"));
  const file = join(dir, "sample.pdf");
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ autoFirstPage: true, compress: false, pdfVersion: "1.4" });
    const out = createWriteStream(file);
    doc.pipe(out);
    out.on("finish", () => {
      const buffer = readFileSync(file);
      rmSync(dir, { recursive: true, force: true });
      resolve(buffer);
    });
    out.on("error", reject);
    for (const line of lines) doc.text(line);
    doc.end();
  });
}

// Regression: pdf-parse's package root (`index.js`) runs a self-test
// (`isDebugMode = !module.parent`) that is truthy under ESM dynamic import,
// so importing the bare package name throws ENOENT trying to read the
// library's own fixture file before the reader ever gets to parse anything.
// This must import `pdf-parse/lib/pdf-parse.js` instead.
test("PdfBlockReader parses a real PDF without the pdf-parse package-root self-test crashing it", async () => {
  const buffer = await buildPdf(["Executive Summary", "This is a short narrative paragraph.", "Indicator Progress", "Describe results against target."]);
  const reader = new PdfBlockReader();
  const result = await reader.parse({ buffer, fileName: "demo.pdf", mimeType: "application/pdf" });
  assert.ok(result.ok, result.ok ? "" : result.error.message);
  assert.equal(result.value.format, "PDF");
  assert.ok(result.value.blocks.length > 0);
  assert.ok(result.value.blocks.some((b) => b.kind !== "TABLE" && /Executive Summary/.test(b.text)));
});
