import assert from "node:assert/strict";
import test from "node:test";
import { estimateCostUsd, isPriced, pricesFromEnv, configureLlmPrices } from "../dist/index.js";

test("H-19: cost is tokens times the per-million price", () => {
  assert.equal(estimateCostUsd("glm-5.3-flash", 1_000_000, 1_000_000), 0.65);
  assert.equal(estimateCostUsd("glm-5.3-flash", 10_000, 2_000), 0.0025);
});

test("H-19: an unpriced model is costed at 0 but reported as unpriced, never silently free", () => {
  assert.equal(estimateCostUsd("brand-new-model", 1_000_000, 1_000_000), 0);
  assert.equal(isPriced("brand-new-model"), false);
  assert.equal(isPriced("glm-5.3-flash"), true);
});

test("H-19: self-hosted and stub models are free and priced", () => {
  for (const m of ["ollama:llama3", "stub-llm", "deterministic"]) {
    assert.equal(isPriced(m), true, m);
    assert.equal(estimateCostUsd(m, 5_000_000, 5_000_000), 0);
  }
});

test("H-19: the operator's rates override the built-in estimate; a dated snapshot matches its listed model", () => {
  const table = pricesFromEnv('{"glm-5.3-flash":{"inputPerMTok":1,"outputPerMTok":2},"bad":{"inputPerMTok":"x"}}');
  assert.deepEqual(Object.keys(table), ["glm-5.3-flash"]);
  assert.equal(estimateCostUsd("glm-5.3-flash", 1_000_000, 1_000_000, table), 3);
  assert.equal(estimateCostUsd("glm-5.3-flash-20261001", 1_000_000, 0, table), 1);
  assert.deepEqual(pricesFromEnv("not json"), {});
  configureLlmPrices({ "my-model": { inputPerMTok: 2, outputPerMTok: 4 } });
  assert.equal(estimateCostUsd("my-model", 1_000_000, 1_000_000), 6);
  configureLlmPrices({});
});

test("H-19: negative token counts cannot produce a negative cost", () => {
  assert.equal(estimateCostUsd("glm-5.3-flash", -5, -5), 0);
});
