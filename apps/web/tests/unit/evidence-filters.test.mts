import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseEvidenceFilters,
  serializeEvidenceFilters,
  withEvidenceFilter,
} from "../../src/lib/shared/evidence-filters.ts";

test("parses known filter keys", () => {
  const params = parseEvidenceFilters([
    ["query", "report"],
    ["verificationStatus", "VERIFIED"],
    ["confidentialityLevel", "SENSITIVE"],
    ["evidenceType", "PHOTO"],
    ["page", "3"],
  ]);
  assert.deepEqual(params, {
    query: "report",
    verificationStatus: "VERIFIED",
    confidentialityLevel: "SENSITIVE",
    evidenceType: "PHOTO",
    page: 3,
  });
});

test("drops unknown and invalid values", () => {
  const params = parseEvidenceFilters([
    ["query", "   "],
    ["page", "abc"],
    ["page", "0"],
    ["hack", "x"],
  ]);
  assert.deepEqual(params, {});
});

test("round-trips through serialize", () => {
  const params = parseEvidenceFilters([
    ["query", "q"],
    ["verificationStatus", "VERIFIED"],
    ["page", "2"],
  ]);
  const qs = serializeEvidenceFilters(params);
  const reparsed = parseEvidenceFilters(new URLSearchParams(qs.replace(/^\?/, "")));
  assert.deepEqual(reparsed, params);
});

test("serialize omits page 1 and empty values", () => {
  assert.equal(serializeEvidenceFilters({ page: 1 }), "");
  assert.equal(serializeEvidenceFilters({}), "");
});

test("withEvidenceFilter sets and clears values and resets page", () => {
  const base = { verificationStatus: "VERIFIED", page: 2 };
  const withType = withEvidenceFilter(base, "evidenceType", "PHOTO");
  assert.equal(withType.evidenceType, "PHOTO");
  assert.equal(withType.page, undefined, "page resets on filter change");
  assert.equal(withType.verificationStatus, "VERIFIED");

  const cleared = withEvidenceFilter({ verificationStatus: "VERIFIED" }, "verificationStatus", undefined);
  assert.equal(cleared.verificationStatus, undefined);
});
