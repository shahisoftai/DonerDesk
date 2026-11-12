import assert from "node:assert/strict";
import test from "node:test";
import { inflateRawSync } from "node:zlib";
import { buildFrameworkDocx, buildFrameworkPdf, FRAMEWORK_FILE_NAME } from "../dist/index.js";
import { renderFramework, FRAMEWORK_LENSES, buildLogframeSnapshot, presetVocabulary } from "@donordesk/domain";

const snapshot = buildLogframeSnapshot(
  [
    { id: "g", level: "GOAL", code: "G", title: "Healthy children", sortOrder: 0 },
    { id: "o", level: "OUTCOME", code: "1", title: "Better feeding", parentId: "g", rationale: "Feeding lowers wasting", assumptions: "Food is available", sortOrder: 1 },
  ],
  [{ id: "n", logframeItemId: "o", code: "IND-1", name: "Caregivers counselled", type: "NUMBER", baseline: "", target: "500", disaggregationRequired: false, isArchived: false, targetBreakdowns: [] }],
);

/** The text of word/document.xml from a .docx (a zip), read without a zip library: enough to check what was written. */
function docxText(buffer) {
  let offset = 0;
  while (offset < buffer.length - 30 && buffer.readUInt32LE(offset) === 0x04034b50) {
    const method = buffer.readUInt16LE(offset + 8);
    const compressed = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const name = buffer.toString("utf8", offset + 30, offset + 30 + nameLength);
    const start = offset + 30 + nameLength + extraLength;
    if (name === "word/document.xml") {
      const data = buffer.subarray(start, start + compressed);
      return (method === 8 ? inflateRawSync(data) : data).toString("utf8");
    }
    offset = start + compressed;
  }
  throw new Error("word/document.xml not found");
}

test("52.2: the Word file carries the donor's title, every result and indicator, and a dash for a gap (never 0)", async () => {
  const doc = renderFramework(snapshot, FRAMEWORK_LENSES.LOGFRAME, presetVocabulary("USAID"));
  const xml = docxText(await buildFrameworkDocx(doc));
  for (const text of ["Results Framework", "Healthy children", "Better feeding", "Food is available", "IND-1", "Caregivers counselled", "500", "Intermediate Result"]) assert.ok(xml.includes(text), text);
  assert.ok(xml.includes("—"), "a baseline nobody set is a dash");
  assert.equal(/>0<\/w:t>/.test(xml), false, "and never a zero");
});

test("52.2: the Results Framework lens file has the reasoning column and not the matrix columns", async () => {
  const xml = docxText(await buildFrameworkDocx(renderFramework(snapshot, FRAMEWORK_LENSES.RESULTS)));
  assert.ok(xml.includes("Why this leads to the result above"));
  assert.ok(xml.includes("Feeding lowers wasting"));
  assert.equal(xml.includes("Means of verification"), false);
});

test("52.2: the PDF is a PDF and the file name follows the donor's title", async () => {
  const doc = renderFramework(snapshot, FRAMEWORK_LENSES.LOGFRAME);
  const pdf = await buildFrameworkPdf(doc);
  assert.equal(pdf.subarray(0, 4).toString("latin1"), "%PDF");
  assert.equal(FRAMEWORK_FILE_NAME(doc, "pdf"), "logframe.pdf");
  assert.equal(FRAMEWORK_FILE_NAME(renderFramework(snapshot, FRAMEWORK_LENSES.RESULTS, presetVocabulary("EU")), "docx"), "intervention-logic.docx");
});
