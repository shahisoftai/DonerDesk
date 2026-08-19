import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createReportDraftEvaluator, type ReportGoldenCase } from "./reporting-eval.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, "../../test/fixtures/reporting-golden.json");
const fixtures = JSON.parse(readFileSync(fixturePath, "utf8")) as { cases: ReportGoldenCase[] };

const evaluator = createReportDraftEvaluator();
const results = fixtures.cases.map((c) => {
  const result = evaluator.evaluateCase(c);
  const expected = c.expected ?? "pass";
  const correct = result.passed === (expected === "pass");
  return { name: c.name, expected, passed: result.passed, correct, scores: result.scores };
});
console.log(JSON.stringify(results, null, 2));
process.exitCode = results.every((r) => r.correct) ? 0 : 1;
