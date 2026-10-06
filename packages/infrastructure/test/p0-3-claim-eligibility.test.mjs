import assert from "node:assert/strict";
import test from "node:test";
import { DeterministicAssertionExtractor } from "../dist/llm/assertion-extractor.js";

const extractor = new DeterministicAssertionExtractor();

/**
 * P0-3 — Claim Eligibility Contract.
 * Not every sentence is a verifiable claim. Before numeric extraction and
 * verification: exclude source/provenance metadata and non-claim text; ensure
 * numbers embedded inside indicator names do not become report-value
 * assertions; keep genuine numeric performance statements as claims.
 */

test("P0-3: a 'Source:' provenance line creates no blocking claim", async () => {
  const content =
    "Reached 500 beneficiaries this quarter. " +
    "Source: Field reports, HMIS data, learning assessments, community surveys.";
  const result = await extractor.extract({ content, writerClaims: [] });
  assert.ok(result.ok);
  const assertionTexts = result.value.map((a) => a.text);
  assert.ok(!assertionTexts.some((t) => /^source:/i.test(t)), "provenance line must not become a claim");
  assert.ok(result.value.some((a) => a.text.includes("Reached 500 beneficiaries")), "genuine claim must remain");
});

test("P0-3: '80%+ attendance' inside an indicator name produces no numeric atom 80", async () => {
  const content =
    "OUT-5 (Number of children attending regularly (80%+ attendance)): 5600 children recorded against a target of 6400 children.";
  const result = await extractor.extract({ content, writerClaims: [] });
  assert.ok(result.ok);
  const assertion = result.value.find((a) => a.text.includes("OUT-5"));
  assert.ok(assertion, "OUT-5 sentence must be an assertion");
  const atomValues = assertion.numericAtoms.map((a) => a.value);
  assert.ok(!atomValues.includes("80"), `indicator-name number '80' must not be extracted; got ${atomValues.join(",")}`);
  assert.ok(atomValues.includes("5600"), "achievement atom 5600 must remain");
  assert.ok(atomValues.includes("6400"), "target atom 6400 must remain");
});

test("P0-3: genuine numeric performance statements still become verifiable claims", async () => {
  const content = "Reached 500 beneficiaries this quarter.";
  const result = await extractor.extract({ content, writerClaims: [] });
  assert.ok(result.ok);
  const numeric = result.value.find((a) => a.type === "NUMERIC");
  assert.ok(numeric, "numeric performance statement must remain a claim");
  assert.equal(numeric.materiality, "MATERIAL");
  assert.ok(numeric.numericAtoms.some((a) => a.value === "500"));
});

test("25.3: an abbreviation's full stop does not split a sentence into two statements (D5-7)", async () => {
  const texts = async (content) => (await extractor.extract({ content, writerClaims: [] })).value.map((a) => a.text);
  const award = "The project is funded under USAID Award No. 72062326CA00001 and reached 142 caregivers.";
  assert.deepEqual(await texts(award), [award], "the award-number sentence stays whole");
  const cases = [
    "Counselling reached approx. 140 caregivers in Kisumu county.",
    "Sites were selected using agreed criteria, e.g. distance to the clinic and population size.",
    "Attendance rose vs. last month, and Dr. Otieno led the sessions at the district hospital.",
  ];
  for (const sentence of cases) assert.deepEqual(await texts(sentence), [sentence], sentence);
  // Real sentence ends still split, including after the word "no" and after "etc.".
  assert.equal((await texts("We reached 142 caregivers. There were no. The team continued.")).length, 3);
  assert.equal((await texts("Nurses, midwives, etc. Counselling reached 142 caregivers.")).length, 2);
});
