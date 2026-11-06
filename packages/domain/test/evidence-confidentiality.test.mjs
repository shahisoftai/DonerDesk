import assert from "node:assert/strict";
import test from "node:test";
import {
  mayReadConfidentiality,
  mayReadEvidence,
  readableConfidentialityLevels,
  isRestrictedConfidentiality,
  CONFIDENTIALITY_READERS,
} from "../dist/index.js";

test("ordinary evidence is open to every role; restricted evidence is not", () => {
  assert.equal(mayReadConfidentiality("VIEWER", "PUBLIC"), true);
  assert.equal(mayReadConfidentiality("VIEWER", "INTERNAL"), true);
  assert.equal(mayReadConfidentiality("VIEWER", "SENSITIVE"), false);
  assert.equal(mayReadConfidentiality("VIEWER", "HIGHLY_SENSITIVE"), false);
});

test("a role that may bring evidence in may open sensitive evidence", () => {
  for (const role of ["ADMIN", "PROJECT_MANAGER", "ME_OFFICER", "GRANTS_OFFICER", "FIELD_OFFICER", "COMPLIANCE_OFFICER"]) {
    assert.equal(mayReadConfidentiality(role, "SENSITIVE"), true, role);
  }
});

test("a role accountable for verification may open highly sensitive evidence", () => {
  for (const role of ["ADMIN", "PROJECT_MANAGER", "ME_OFFICER", "COMPLIANCE_OFFICER"]) {
    assert.equal(mayReadConfidentiality(role, "HIGHLY_SENSITIVE"), true, role);
  }
  for (const role of ["FIELD_OFFICER", "VIEWER"]) {
    assert.equal(mayReadConfidentiality(role, "HIGHLY_SENSITIVE"), false, role);
  }
});

test("a role that may put restricted evidence in a donor report may open it", () => {
  // The grants officer may override confidentiality on export, so the file
  // must be openable to them.
  assert.equal(mayReadConfidentiality("GRANTS_OFFICER", "HIGHLY_SENSITIVE"), true);
});

test("the person who uploaded a file can always open their own", () => {
  const uploaded = { confidentialityLevel: "HIGHLY_SENSITIVE", uploadedById: "u-1" };
  assert.equal(mayReadEvidence({ userId: "u-1", role: "FIELD_OFFICER" }, uploaded), true);
  assert.equal(mayReadEvidence({ userId: "u-2", role: "FIELD_OFFICER" }, uploaded), false);
});

test("the readable levels are exactly the ones the role may open", () => {
  assert.deepEqual(readableConfidentialityLevels("VIEWER"), ["PUBLIC", "INTERNAL"]);
  assert.deepEqual(readableConfidentialityLevels("FIELD_OFFICER"), ["PUBLIC", "INTERNAL", "SENSITIVE"]);
  assert.deepEqual(readableConfidentialityLevels("COMPLIANCE_OFFICER"), [
    "PUBLIC",
    "INTERNAL",
    "SENSITIVE",
    "HIGHLY_SENSITIVE",
  ]);
  assert.deepEqual(readableConfidentialityLevels("GRANTS_OFFICER"), [
    "PUBLIC",
    "INTERNAL",
    "SENSITIVE",
    "HIGHLY_SENSITIVE",
  ]);
});

test("the restricted levels are the two a report writer never sees", () => {
  assert.equal(isRestrictedConfidentiality("PUBLIC"), false);
  assert.equal(isRestrictedConfidentiality("INTERNAL"), false);
  assert.equal(isRestrictedConfidentiality("SENSITIVE"), true);
  assert.equal(isRestrictedConfidentiality("HIGHLY_SENSITIVE"), true);
});

test("every confidentiality level has a rule", () => {
  for (const level of ["PUBLIC", "INTERNAL", "SENSITIVE", "HIGHLY_SENSITIVE"]) {
    assert.ok(Array.isArray(CONFIDENTIALITY_READERS[level]), level);
  }
});
