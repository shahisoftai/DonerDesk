import { test } from "node:test";
import assert from "node:assert/strict";
import { describeValidationIssue, fieldLabelForPath, friendlyIssueMessage } from "../dist/index.js";

test("a long need line is named and explained, not shown as a raw path", () => {
  const text = describeValidationIssue({ path: ["scope", "needs", 0], message: "String must contain at most 200 character(s)" });
  assert.equal(text, "Main needs (one per line): can be up to 200 characters; shorten it or split it across lines");
});

test("a half-filled affected-population row says which part is missing", () => {
  assert.equal(describeValidationIssue({ path: ["scope", "affectedPopulation", 0, "group"], message: "String must contain at least 1 character(s)" }), "Affected population: who: is required");
});

test("unknown paths keep their path and message so API clients see what they always saw", () => {
  assert.equal(fieldLabelForPath(["projectCode"]), "Project code");
  assert.equal(friendlyIssueMessage("Something else"), "Something else");
  assert.equal(describeValidationIssue({ path: ["f0"], message: "Required" }), "f0: Required");
});
