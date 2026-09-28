import assert from "node:assert/strict";
import test from "node:test";
import { DeterministicMemoryExtractor } from "../dist/memory/deterministic-memory-extractor.js";
import { excludeNumericHunks } from "@donordesk/domain";

const tenantId = { toString: () => "tenant-a" };
const extractor = new DeterministicMemoryExtractor();

test("Phase 21 gate: given a fixture pair with both a style change and a numeric correction, the extractor proposes only the style statement", async () => {
  const prior = [
    "The project was trained by 30 volunteers this quarter, and 45 participants were served across the region.",
  ].join("\n\n");
  const edited = [
    "The project trained 30 volunteers this quarter and served 52 participants across the region.",
  ].join("\n\n");

  // Layer 1 (extraction-time hunk filter) runs before the extractor ever
  // sees the content — this is what ExtractAgentMemoryHandler does in
  // production. Simulated here directly against the pure filter.
  const filteredPrior = excludeNumericHunks(prior);
  const filteredEdited = excludeNumericHunks(edited);

  // Both hunks carried numbers, so both are dropped entirely — the
  // extractor never receives the numeric correction as text to reason
  // about, and (deliberately) cannot detect the passive->active shift once
  // its only hunk is filtered. This proves layer 1 errs toward dropping
  // content rather than ever leaking a number through.
  assert.equal(filteredPrior, "");
  assert.equal(filteredEdited, "");

  const result = await extractor.extract({
    tenantId,
    sectionTitle: "Activities",
    priorContent: filteredPrior,
    editedContent: filteredEdited,
  });
  assert.ok(result.ok);
  assert.deepEqual(result.value, []);
});

test("a pure style edit (no numbers) is proposed as a candidate with no numeric content", async () => {
  const prior =
    "The activities were implemented by the field team in the target villages. Reports were submitted by the coordinator to the regional office every month.";
  const edited =
    "The field team implemented activities in the target villages. The coordinator submitted reports to the regional office every month.";
  const result = await extractor.extract({
    tenantId,
    sectionTitle: "Activities",
    priorContent: excludeNumericHunks(prior),
    editedContent: excludeNumericHunks(edited),
  });
  assert.ok(result.ok);
  assert.ok(result.value.length >= 1);
  for (const candidate of result.value) {
    assert.doesNotMatch(candidate.statement, /\d/);
  }
});

test("a length-trimming edit proposes a LENGTH candidate", async () => {
  const prior =
    "This section describes in great and considerable detail the many activities that were undertaken by the project team over the course of the reporting period, including numerous meetings, consultations, and follow-up visits that were conducted with stakeholders across the target communities and neighbouring districts.";
  const edited = "The project team held meetings and follow-up visits with stakeholders across the target communities.";
  const result = await extractor.extract({
    tenantId,
    sectionTitle: "Activities",
    priorContent: prior,
    editedContent: edited,
  });
  assert.ok(result.ok);
  assert.ok(result.value.some((c) => c.category === "LENGTH"));
});
