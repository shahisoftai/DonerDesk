import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPeriodBlock } from "../dist/llm/llm-report-draft-generator.js";
import { WRITER_EXCLUDED_PERIOD_KEYS } from "../dist/llm/ai-reporter/contract.js";

const period = { reportType: "FINAL", startDate: "2026-03-01", endDate: "2026-08-31", deadline: "2026-09-15", readinessScore: 0, daysUntilDeadline: 30 };

test("the legacy narrator's period block never carries workflow state (a readiness score once reached donor text)", () => {
  const text = buildPeriodBlock({ period }).join("\n");
  assert.match(text, /Report Type: FINAL/);
  assert.doesNotMatch(text, /readiness/i);
  for (const key of WRITER_EXCLUDED_PERIOD_KEYS) assert.equal(text.includes(key), false, key);
});

test("no writer module reads a period's readiness score", () => {
  for (const file of ["llm/ai-reporter-draft-generator.ts", "llm/llm-report-draft-generator.ts", "llm/ai-reporter-worker.ts"]) {
    const source = readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /readinessScore/, file);
  }
});
