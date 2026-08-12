import { test } from "node:test";
import assert from "node:assert/strict";
import { protectedFileDownloadHref } from "../../src/lib/shared/downloads.ts";

test("converts a protected storage path into a BFF download link", () => {
  const href = protectedFileDownloadHref("/v1/files/tenant-a%2Fevidence%2Fabc.pdf");
  assert.equal(href, "/api/files/tenant-a/evidence/abc.pdf");
});

test("appends a sanitized filename when provided", () => {
  const href = protectedFileDownloadHref("/v1/files/tenant-a%2Fevidence%2Fabc.pdf", "field report.pdf");
  assert.ok(href.includes("?name="));
  assert.ok(href.includes("field%20report.pdf"));
});

test("returns non-protected URLs unchanged", () => {
  assert.equal(protectedFileDownloadHref("https://cdn.example.com/x.pdf"), "https://cdn.example.com/x.pdf");
});
