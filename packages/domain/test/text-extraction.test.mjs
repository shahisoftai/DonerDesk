import assert from "node:assert/strict";
import test from "node:test";
import { assessTextExtraction, extractionMessage, isTextExtractionStatus, TEXT_EXTRACTION_STATUSES } from "../dist/index.js";

test("readable text is extracted", () => {
  assert.deepEqual(assessTextExtraction({ fileName: "plan.docx", text: "Output 1: trained 40 people" }), { status: "EXTRACTED" });
});

test("empty text names the file and the way out, and never leaks a technical error", () => {
  const r = assessTextExtraction({ fileName: "scan.pdf", text: "  \n " });
  assert.equal(r.status, "EMPTY");
  assert.match(r.message, /scan\.pdf/);
  assert.match(r.message, /paste the text/);
});

test("a parser error is FAILED even when some text came back", () => {
  const r = assessTextExtraction({ fileName: "a.docx", text: "partial", failed: true });
  assert.equal(r.status, "FAILED");
  assert.doesNotMatch(r.message, /Error|stack|undefined/);
});

test("images and the file-name placeholder are UNSUPPORTED", () => {
  assert.equal(assessTextExtraction({ fileName: "photo.JPG", text: "photo.jpg" }).status, "UNSUPPORTED");
  assert.equal(assessTextExtraction({ fileName: "photo.png", text: "" }).status, "UNSUPPORTED");
  assert.equal(assessTextExtraction({ fileName: "notes.bin", text: "NOTES.BIN" }).status, "UNSUPPORTED");
});

test("every non-extracted status has a sentence", () => {
  for (const status of TEXT_EXTRACTION_STATUSES.filter((s) => s !== "EXTRACTED")) assert.ok(extractionMessage(status, "f.pdf").length > 20);
  assert.equal(isTextExtractionStatus("FAILED"), true);
  assert.equal(isTextExtractionStatus("nope"), false);
});

test("words read from a scan by text recognition count as read, even for an image", () => {
  assert.equal(assessTextExtraction({ fileName: "photo.png", text: "Sign-in sheet: 24 present", readByOcr: true }).status, "EXTRACTED");
  assert.equal(assessTextExtraction({ fileName: "scan.pdf", text: "Wells drilled: 12", readByOcr: true }).status, "EXTRACTED");
  // recognition that found nothing is not read
  assert.equal(assessTextExtraction({ fileName: "photo.png", text: "  ", readByOcr: true }).status, "UNSUPPORTED");
  // without recognition an image is still not readable
  assert.equal(assessTextExtraction({ fileName: "photo.png", text: "Sign-in sheet" }).status, "UNSUPPORTED");
});
