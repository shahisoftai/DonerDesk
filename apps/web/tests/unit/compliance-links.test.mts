import { test } from "node:test";
import assert from "node:assert/strict";
import { complianceFixLink } from "../../src/lib/shared/compliance-links.ts";

const base = { projectId: "p1", periodId: "r1" };

test("missing evidence links to the evidence library", () => {
  const target = complianceFixLink({ ...base, type: "MISSING_EVIDENCE" });
  assert.equal(target?.href, "/projects/p1/evidence");
});

test("unverified indicator links to logframe", () => {
  const target = complianceFixLink({ ...base, type: "UNVERIFIED_INDICATOR" });
  assert.equal(target?.href, "/projects/p1/logframe");
});

test("unsupported claim links to the report workspace", () => {
  const target = complianceFixLink({ ...base, type: "UNSUPPORTED_REPORT_CLAIM" });
  assert.equal(target?.href, "/projects/p1/reports/r1");
});

test("linked evidence overrides type-based destination", () => {
  const target = complianceFixLink({
    ...base,
    type: "MISSING_EVIDENCE",
    relatedEntityType: "evidence",
    relatedEntityId: "ev-9",
  });
  assert.equal(target?.href, "/projects/p1/evidence/ev-9");
});

test("linked activity navigates to activity detail", () => {
  const target = complianceFixLink({
    ...base,
    type: "LATE_ACTIVITY_UPDATE",
    relatedEntityType: "activity",
    relatedEntityId: "act-2",
  });
  assert.equal(target?.href, "/projects/p1/activities/act-2");
});

test("unknown type returns null", () => {
  const target = complianceFixLink({ ...base, type: "SOMETHING_ELSE" });
  assert.equal(target, null);
});
