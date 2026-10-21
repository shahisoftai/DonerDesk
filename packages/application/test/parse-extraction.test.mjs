import assert from "node:assert/strict";
import test from "node:test";
import { ParseUploadedFileHandler, PersistEvidenceTagsHandler } from "../dist/index.js";
import { EvidenceFile, TenantId, MAX_PARSE_FILE_BYTES } from "@donordesk/domain";

const parserReturning = (result) => ({ parse: async () => result });
const upload = (buffer, fileName = "plan.docx") => ({ buffer, fileName, fileType: "application/octet-stream" });

test("a readable file returns its text", async () => {
  const r = await new ParseUploadedFileHandler(parserReturning({ text: "Output 1" })).handle(upload(Buffer.from("x")));
  assert.deepEqual(r, { ok: true, value: { text: "Output 1" } });
});

test("H-20: a scanned PDF is refused with a plain sentence, not returned as an empty box", async () => {
  const r = await new ParseUploadedFileHandler(parserReturning({ text: "" })).handle(upload(Buffer.from("x"), "scan.pdf"));
  assert.equal(r.ok, false);
  assert.equal(r.error.code, "VALIDATION_FAILED");
  assert.match(r.error.message, /scan\.pdf/);
  assert.match(r.error.message, /paste the text/);
  assert.equal(r.error.details.reason, "EMPTY");
});

test("H-20: the parser's parseError becomes a FAILED refusal that never shows the technical error", async () => {
  const handler = new ParseUploadedFileHandler(parserReturning({ text: "", metadata: { parseError: "Error: bad xref at 0x1f" } }));
  const r = await handler.handle(upload(Buffer.from("x"), "broken.pdf"));
  assert.equal(r.ok, false);
  assert.equal(r.error.details.reason, "FAILED");
  assert.doesNotMatch(r.error.message, /xref|Error:/);
});

test("H-20: an empty file and an over-size file are refused before the parser runs", async () => {
  let called = 0;
  const handler = new ParseUploadedFileHandler({ parse: async () => { called += 1; return { text: "x" }; } });
  assert.equal((await handler.handle(upload(Buffer.alloc(0)))).ok, false);
  const big = await handler.handle(upload(Buffer.alloc(MAX_PARSE_FILE_BYTES + 1), "huge.xlsx"));
  assert.equal(big.ok, false);
  assert.match(big.error.message, /huge\.xlsx is larger than 20 MB/);
  assert.equal(called, 0);
});

test("H-20: an image gets the unsupported sentence", async () => {
  const r = await new ParseUploadedFileHandler(parserReturning({ text: "photo.png" })).handle(upload(Buffer.from("x"), "photo.png"));
  assert.equal(r.error.details.reason, "UNSUPPORTED");
});

// --- evidence record ---
const tenantId = TenantId.create("tenant-a");
const ctx = { tenant: { tenantId, userId: "u" }, requestId: "r" };
function evidence(fileName = "report.pdf") {
  return EvidenceFile.create({
    id: "e1", tenantId: "tenant-a", projectId: "p1", fileName, title: "Report", fileUrl: "/v1/files/x", fileType: "application/pdf",
    fileSize: 10, evidenceType: "REPORT", uploadedById: "u", confidentialityLevel: "INTERNAL",
  });
}
function persist(ev) {
  const repo = { findById: async () => ({ ok: true, value: ev }), update: async (e) => ({ ok: true, value: e }) };
  return new PersistEvidenceTagsHandler(repo, { record: async () => {} });
}
const base = { summary: "s", tags: [] };

test("H-20: text that arrives marks the evidence EXTRACTED", async () => {
  const ev = evidence();
  assert.equal((await persist(ev).handle(ctx, "e1", { ...base, extractedText: "Trained 40 people." })).ok, true);
  assert.equal(ev.textExtractionStatus, "EXTRACTED");
  assert.equal(ev.textExtractionNote, undefined);
  assert.equal(ev.extractedText, "Trained 40 people.");
});

test("H-20: an empty extraction is recorded with a sentence, not left looking fine", async () => {
  const ev = evidence("scan.pdf");
  await persist(ev).handle(ctx, "e1", { ...base, extractedText: "" });
  assert.equal(ev.textExtractionStatus, "EMPTY");
  assert.match(ev.textExtractionNote, /scan\.pdf/);
});

test("H-20: a reported FAILED wins over stray text, and a later good extraction clears it", async () => {
  const ev = evidence();
  await persist(ev).handle(ctx, "e1", { ...base, extractedText: "garbage", extractionStatus: "FAILED" });
  assert.equal(ev.textExtractionStatus, "FAILED");
  await persist(ev).handle(ctx, "e1", { ...base, extractedText: "Real text now." });
  assert.equal(ev.textExtractionStatus, "EXTRACTED");
  assert.equal(ev.textExtractionNote, undefined);
});

test("H-20: a callback that says nothing about extraction leaves it not attempted", async () => {
  const ev = evidence();
  await persist(ev).handle(ctx, "e1", base);
  assert.equal(ev.textExtractionStatus, undefined);
});

test("a photographed page read by text recognition is accepted and carries its note", async () => {
  const handler = new ParseUploadedFileHandler({ parse: async () => ({ text: "Sign-in sheet: 24 present", metadata: { ocr: { confidence: 0.9, pagesRead: 1, pagesTotal: 1 }, ocrNote: "check it" } }) });
  const r = await handler.handle({ buffer: Buffer.from("x"), fileName: "photo.png", fileType: "image/png" });
  assert.equal(r.ok, true);
  assert.equal(r.value.text, "Sign-in sheet: 24 present");
  assert.equal(r.value.metadata.ocrNote, "check it");
});
