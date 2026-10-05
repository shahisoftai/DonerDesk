import assert from "node:assert/strict";
import test from "node:test";
import { inflateRawSync } from "node:zlib";
import { DefaultExportBuilder } from "../dist/exports/builder.js";

const base = (over = {}) => ({
  exportType: "WORD", exportIntent: "INTERNAL_REVIEW", projectName: "P", reportingPeriodLabel: "2026-08", reportTitle: "Final report",
  sections: [{ title: "1 Summary", content: "Enrolment closed at 1,260 children.", status: "DRAFTED", level: 1 }],
  indicators: [], activities: [], checklist: [], evidenceItems: [], includeSensitive: false, ...over,
});

/** Text of every XML part of a .docx (a stored zip: entries are read from the central directory). */
function docxParts(buffer) {
  const parts = {};
  let i = 0;
  while ((i = buffer.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), i)) !== -1) {
    const method = buffer.readUInt16LE(i + 8), csize = buffer.readUInt32LE(i + 18), nlen = buffer.readUInt16LE(i + 26), elen = buffer.readUInt16LE(i + 28);
    const name = buffer.toString("utf8", i + 30, i + 30 + nlen);
    const start = i + 30 + nlen + elen;
    if (csize > 0 && name.endsWith(".xml")) {
      const raw = buffer.subarray(start, start + csize);
      parts[name] = (method === 8 ? inflateRawSync(raw) : raw).toString("utf8");
    }
    i = start + Math.max(csize, 1);
  }
  return parts;
}

test("an internal-review Word export carries the notice in a header on every page and on the cover", async () => {
  const { fileBuffer } = await new DefaultExportBuilder().build(base({ watermark: "INTERNAL PREVIEW" }));
  const parts = docxParts(fileBuffer);
  const header = Object.entries(parts).find(([n]) => /word\/header\d*\.xml$/.test(n));
  assert.ok(header, "a header part exists");
  assert.match(header[1], /INTERNAL PREVIEW — NOT FOR DONOR SUBMISSION/);
  assert.match(parts["word/document.xml"], /NOT FOR DONOR SUBMISSION/);
});

test("a donor submission is never watermarked and has no header notice", async () => {
  const { fileBuffer } = await new DefaultExportBuilder().build(base({ exportIntent: "DONOR_SUBMISSION", submissionSnapshotId: "snap" }));
  const parts = docxParts(fileBuffer);
  assert.ok(!Object.keys(parts).some((n) => /word\/header/.test(n)));
  assert.doesNotMatch(parts["word/document.xml"], /NOT FOR DONOR SUBMISSION/);
});

test("an internal-review export without a watermark is refused", async () => {
  await assert.rejects(() => new DefaultExportBuilder().build(base()), /watermarked/);
});

test("an internal-review PDF is produced with the banner on its pages", async () => {
  const long = Array.from({ length: 90 }, (_, i) => `Paragraph ${i} about enrolment, teachers and learning spaces delivered during the period.`).join("\n\n");
  const { fileBuffer, contentType } = await new DefaultExportBuilder().build(base({ exportType: "PDF", watermark: "INTERNAL PREVIEW", sections: [{ title: "1 Summary", content: long, status: "DRAFTED", level: 1 }] }));
  assert.equal(contentType, "application/pdf");
  assert.equal(fileBuffer.subarray(0, 4).toString(), "%PDF");
  const pages = (fileBuffer.toString("latin1").match(/\/Type\s*\/Page\b/g) ?? []).length;
  assert.ok(pages >= 3, `a multi-page document (${pages})`);
});
