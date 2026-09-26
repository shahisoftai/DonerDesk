import assert from "node:assert/strict";
import test from "node:test";
import { DeterministicEntailmentVerifier } from "../dist/llm/verifier-strategies.js";

test("contradiction bug fix: an unrelated evidence chunk containing a contradiction phrase does not flip a well-supported claim", async () => {
  const verifier = new DeterministicEntailmentVerifier();
  const result = await verifier.verify({
    assertionText: "The project trained 58 teachers this period",
    assertionType: "FACTUAL",
    evidence: [
      // Best match: clearly supports the claim, no contradiction language.
      { evidenceId: "e-1", chunkId: "c1", chunkText: "58 teachers were recruited and completed training during the reporting period.", score: 1 },
      // Unrelated chunk about a different topic that happens to contain "did not" —
      // must NOT be allowed to flip the verdict for the teacher-training claim.
      { evidenceId: "e-2", chunkId: "c2", chunkText: "Flooding risk assessment: the northern camp did not experience flooding this period.", score: 0.1 },
    ],
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.verdict, "SUPPORTED", `expected SUPPORTED, got ${result.value.verdict}`);
});

test("contradiction check still fires when the BEST-matching chunk itself contains the contradiction phrase", async () => {
  const verifier = new DeterministicEntailmentVerifier();
  const result = await verifier.verify({
    assertionText: "Training sessions were delivered to 45 participants",
    assertionType: "FACTUAL",
    evidence: [
      { evidenceId: "e-1", chunkId: "c1", chunkText: "No evidence training sessions were delivered to 45 participants.", score: 1 },
    ],
  });
  assert.equal(result.value.verdict, "CONTRADICTED");
});

test("natural paraphrase (different inflection) is recognised as supporting, not just exact-word overlap", async () => {
  const verifier = new DeterministicEntailmentVerifier();
  const result = await verifier.verify({
    assertionText: "Teacher recruitment reached 58 against a target of 240",
    assertionType: "NUMERIC",
    evidence: [
      { evidenceId: "e-1", chunkId: "c1", chunkText: "58 teachers were recruited and deployed this period out of a planned 240.", score: 1 },
    ],
  });
  assert.notEqual(result.value.verdict, "INSUFFICIENT", "a natural paraphrase should not be graded as insufficient evidence");
});

test("empty assertion text returns UNCERTAIN with zero confidence", async () => {
  const verifier = new DeterministicEntailmentVerifier();
  const result = await verifier.verify({
    assertionText: "",
    assertionType: "FACTUAL",
    evidence: [{ evidenceId: "e-1", chunkId: "c1", chunkText: "anything", score: 1 }],
  });
  assert.equal(result.value.verdict, "UNCERTAIN");
  assert.equal(result.value.confidence, 0);
});
