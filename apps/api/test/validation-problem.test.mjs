import assert from "node:assert/strict";
import test from "node:test";
import { AcknowledgeProjectSetupSchema } from "@donordesk/contracts";
import { validationTitle } from "../dist/validation-problem.js";

test("a bare setup acknowledgement says what to send", () => {
  const r = AcknowledgeProjectSetupSchema.safeParse({});
  assert.equal(r.success, false);
  assert.equal(validationTitle(r.error), 'Validation failed — acknowledged: Send {"acknowledged": true} to confirm the setup.');
});

test("long lists are summarised and no issues falls back to the plain title", () => {
  const issues = Array.from({ length: 5 }, (_, i) => ({ path: ["f" + i], message: "Required" }));
  assert.equal(validationTitle({ issues }), "Validation failed — f0: Required; f1: Required; f2: Required; and 2 more");
  assert.equal(validationTitle({ issues: [] }), "Validation failed");
  assert.equal(validationTitle({ issues: [{ path: [], message: "Expected object" }] }), "Validation failed — Expected object");
});
