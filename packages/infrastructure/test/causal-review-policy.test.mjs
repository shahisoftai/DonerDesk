import assert from "node:assert/strict";
import test from "node:test";
import { CausalReviewPolicy } from "../dist/llm/verifier-strategies.js";

const policy = new CausalReviewPolicy();

test("a cause the officer's own records state does not ask for another decision (demo 7)", () => {
  assert.equal(policy.requiresHumanDecision("CAUSAL", "SUPPORTED", ["record:story:challenges", "record:activity-1"]), false);
});

test("a cause supported only by uploaded evidence, or uncertain, still needs a person", () => {
  assert.equal(policy.requiresHumanDecision("CAUSAL", "SUPPORTED", ["ev-1"]), true);
  assert.equal(policy.requiresHumanDecision("CAUSAL", "SUPPORTED", ["record:a", "ev-1"]), true);
  assert.equal(policy.requiresHumanDecision("CAUSAL", "SUPPORTED"), true);
  assert.equal(policy.requiresHumanDecision("CAUSAL", "UNCERTAIN", ["record:a"]), true);
  assert.equal(policy.requiresHumanDecision("NUMERIC", "SUPPORTED", ["record:a"]), false);
});
