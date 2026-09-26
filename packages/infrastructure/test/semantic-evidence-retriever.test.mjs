import assert from "node:assert/strict";
import test from "node:test";
import { SemanticEvidenceRetriever } from "../dist/llm/semantic-evidence-retriever.js";

const failingGenerator = { embed: async () => ({ ok: false, error: { message: "no provider configured" } }) };
const unusedStore = { nearestNeighbors: async () => ({ ok: true, value: [] }) };

const packages = [
  {
    evidenceId: "ev-1",
    evidenceType: "TRAINING_RECORD",
    verificationStatus: "VERIFIED",
    chunks: [{ chunkId: "c1", text: "58 teachers were recruited and completed training this period." }],
  },
  {
    evidenceId: "ev-2",
    evidenceType: "FIELD_VISIT_REPORT",
    verificationStatus: "VERIFIED",
    chunks: [{ chunkId: "c2", text: "Flooding risk assessment for the northern learning centres." }],
  },
];

test("falls back to lexical retrieval when the embedding provider is unavailable, and ranks the paraphrased match first", async () => {
  const retriever = new SemanticEvidenceRetriever(packages, failingGenerator, unusedStore);
  const result = await retriever.retrieve({
    tenantId: "tenant-1",
    sectionTitle: "Teacher recruitment and training",
    entities: [],
    dates: [],
    indicatorCodes: [],
  });
  assert.equal(result.ok, true);
  assert.ok(result.value.length > 0, "expected at least one ranked chunk");
  assert.equal(result.value[0].chunkId, "c1", "the teacher-training chunk should outrank the unrelated flooding chunk");
});

test("uses the embedding-backed nearest-neighbor path (not the lexical fallback) when a provider and store are available", async () => {
  const workingGenerator = { embed: async () => ({ ok: true, value: [0.1, 0.2, 0.3] }) };
  let nearestNeighborsCalled = false;
  const workingStore = {
    nearestNeighbors: async () => {
      nearestNeighborsCalled = true;
      return {
        ok: true,
        value: [{ chunkId: "c1", evidenceId: "ev-1", text: packages[0].chunks[0].text, score: 0.95 }],
      };
    },
  };
  const retriever = new SemanticEvidenceRetriever(packages, workingGenerator, workingStore);
  const result = await retriever.retrieve({
    tenantId: "tenant-1",
    sectionTitle: "Teacher recruitment and training",
    entities: [],
    dates: [],
    indicatorCodes: [],
  });
  assert.equal(result.ok, true);
  assert.equal(nearestNeighborsCalled, true, "expected the semantic (embedding) path to be used, not the lexical fallback, when a working provider is configured");
  assert.ok(result.value.length > 0);
  assert.equal(result.value[0].chunkId, "c1");
});

test("returns empty ranked list (not an error) when nothing matches the query", async () => {
  const retriever = new SemanticEvidenceRetriever(packages, failingGenerator, unusedStore);
  const result = await retriever.retrieve({
    tenantId: "tenant-1",
    sectionTitle: "completely unrelated budget variance topic",
    entities: [],
    dates: [],
    indicatorCodes: [],
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.length, 0);
});
