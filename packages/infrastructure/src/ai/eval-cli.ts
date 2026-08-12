import { readFile } from "node:fs/promises";
import { EvaluationHarness } from "./eval.js";

interface GoldenCase { name: string; reference: string; hypothesis: string; threshold: number }

const fixtureUrl = new URL("../../test/fixtures/ai-eval.json", import.meta.url);
const cases = JSON.parse(await readFile(fixtureUrl, "utf8")) as GoldenCase[];
if (!Array.isArray(cases) || cases.length === 0) throw new Error("AI evaluation dataset is empty");
const harness = new EvaluationHarness();
const results = cases.map((item) => ({ name: item.name, ...harness.evaluate(item.reference, item.hypothesis, item.threshold) }));
console.log(JSON.stringify(results, null, 2));
if (results.some((result) => !result.passed)) process.exitCode = 1;
