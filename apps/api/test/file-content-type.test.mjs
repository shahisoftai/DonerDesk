import assert from "node:assert/strict";
import test from "node:test";
import { contentTypeForKey } from "../dist/routes/files.js";

test("stored files are served with the type their extension says, so Word and PDF viewers open them", () => {
  assert.equal(contentTypeForKey("t1/exports/abc.docx"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  assert.equal(contentTypeForKey("t1/exports/abc.PDF"), "application/pdf");
  assert.equal(contentTypeForKey("t1/exports/abc.xlsx"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  assert.equal(contentTypeForKey("t1/exports/pack.zip"), "application/zip");
  assert.equal(contentTypeForKey("t1/evidence/unknown.bin"), "application/octet-stream");
  assert.equal(contentTypeForKey("t1/evidence/noext"), "application/octet-stream");
});
