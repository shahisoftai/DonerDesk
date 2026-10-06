import assert from "node:assert/strict";
import test from "node:test";
import { summarizeAiRun, countAiRunOutcomes } from "../dist/index.js";

const at = new Date("2026-10-06T10:00:00Z");
const run = (over) => ({ id: "r", status: "success", latencyMs: 4200, inputTokens: 1000, outputTokens: 400, createdAt: at, ...over });
const diag = (o) => JSON.stringify({ sectionTitle: "Progress", attempts: 1, ...o });

test("a clean run is WRITTEN, a retried success is RECOVERED", () => {
  const written = summarizeAiRun(run({ responseText: diag({}) }));
  assert.deepEqual([written.outcome, written.attempts, written.tokens, written.sectionTitle, written.reason], ["WRITTEN", 1, 1400, "Progress", null]);
  const recovered = summarizeAiRun(run({ responseText: diag({ attempts: 2 }) }));
  assert.equal(recovered.outcome, "RECOVERED");
});

test("a stub run carries its reason and user-safe detail; unknown reasons are not echoed", () => {
  const stub = summarizeAiRun(run({ status: "error", errorMessage: "VALIDATOR_FAILED", responseText: diag({ attempts: 2, fallbackDetail: "figures not in your data: 33.3, 26.2" }) }));
  assert.deepEqual([stub.outcome, stub.reason, stub.detail, stub.attempts], ["STUB", "VALIDATOR_FAILED", "figures not in your data: 33.3, 26.2", 2]);
  const timeout = summarizeAiRun(run({ status: "timeout", errorMessage: "PROVIDER_TIMEOUT", responseText: diag({}) }));
  assert.equal(timeout.reason, "PROVIDER_TIMEOUT");
  const unknown = summarizeAiRun(run({ status: "error", errorMessage: "SOME_INTERNAL_CODE", responseText: diag({}) }));
  assert.equal(unknown.reason, null);
});

test("a skipped run is NO_INPUT; broken diagnostics never throw", () => {
  assert.equal(summarizeAiRun(run({ status: "skipped", responseText: diag({}) })).outcome, "NO_INPUT");
  for (const responseText of [null, undefined, "", "{not json", "[1,2]", "7"]) {
    const s = summarizeAiRun(run({ responseText }));
    assert.deepEqual([s.sectionTitle, s.attempts, s.outcome], [null, 1, "WRITTEN"]);
  }
  assert.equal(summarizeAiRun(run({ responseText: diag({ attempts: "many" }) })).attempts, 1);
});

test("counts per outcome", () => {
  const runs = [run({ responseText: diag({}) }), run({ responseText: diag({ attempts: 2 }) }), run({ status: "error", errorMessage: "PROVIDER_TIMEOUT" })].map(summarizeAiRun);
  assert.deepEqual(countAiRunOutcomes(runs), { WRITTEN: 1, RECOVERED: 1, STUB: 1, NO_INPUT: 0 });
});

import { aiStubAlert } from "../dist/index.js";

const mk = (hoursAgo, outcome) => ({ id: `${hoursAgo}${outcome}`, at: new Date(new Date("2026-10-06T12:00:00Z").getTime() - hoursAgo * 3600_000), sectionTitle: null, outcome, reason: null, detail: null, attempts: 1, latencyMs: 1, tokens: 1 });
const now = new Date("2026-10-06T12:00:00Z");

test("the stub alert fires on a streak or a high rate, never on a quiet or healthy day (25.9)", () => {
  assert.equal(aiStubAlert([], now), null);
  assert.equal(aiStubAlert([mk(1, "WRITTEN"), mk(2, "WRITTEN"), mk(3, "STUB"), mk(4, "WRITTEN"), mk(5, "WRITTEN")], now), null, "1 of 5 is healthy");
  assert.match(aiStubAlert([mk(1, "STUB"), mk(2, "STUB"), mk(3, "STUB"), mk(4, "WRITTEN")], now).reason, /last 3 sections in a row/);
  const rate = aiStubAlert([mk(1, "STUB"), mk(2, "WRITTEN"), mk(3, "STUB"), mk(4, "WRITTEN"), mk(5, "WRITTEN")], now);
  assert.match(rate.reason, /2 of 5 sections/);
  assert.equal(aiStubAlert([mk(1, "STUB"), mk(2, "WRITTEN"), mk(3, "STUB")], now), null, "too few runs for a rate");
  assert.equal(aiStubAlert([mk(30, "STUB"), mk(31, "STUB"), mk(32, "STUB")], now), null, "older than a day");
  assert.equal(aiStubAlert([mk(1, "NO_INPUT"), mk(2, "NO_INPUT")], now), null, "no-input runs do not count");
});
