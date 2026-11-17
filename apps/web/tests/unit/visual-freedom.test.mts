import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { filterFields, suggestVisualFor } from "../../src/features/canvas/editor/domain/data-fields.ts";

const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p] : []; });

test("block output never truncates its words (Phase 61.5): no truncate, line-clamp or ellipsis in what a block draws", () => {
  const bad: string[] = [];
  for (const dir of ["src/features/canvas/presentation/screens", "src/features/canvas/filters"]) {
    for (const f of files(dir)) {
      const text = readFileSync(f, "utf8");
      if (/\btruncate\b|line-clamp|text-ellipsis|overflow-ellipsis/.test(text)) bad.push(f);
    }
  }
  assert.deepEqual(bad, [], "text on a block wraps; use break-words");
});

test("the print text helper never ends a line in an ellipsis", () => {
  const kit = readFileSync("../../packages/infrastructure/src/infographics/kit.ts", "utf8");
  const wrap = kit.slice(kit.indexOf("export function wrapText"), kit.indexOf("export interface TextOpts"));
  assert.ok(/Number\.POSITIVE_INFINITY/.test(wrap), "wrapText has no line limit");
});

const FIELDS = [
  { id: "a", code: "1.1", name: "People reached with water" }, { id: "b", code: "1.2", name: "Latrines built" }, { id: "c", code: "2.1", name: "Children vaccinated" },
];

test("the data panel lists every indicator and filters by code or name, ignoring accents", () => {
  assert.equal(filterFields(FIELDS, "").length, 3);
  assert.deepEqual(filterFields(FIELDS, "latrin").map((f) => f.id), ["b"]);
  assert.deepEqual(filterFields(FIELDS, "2.1").map((f) => f.id), ["c"]);
  assert.deepEqual(filterFields([{ id: "x", code: "9", name: "Écoles" }], "ecole").map((f) => f.id), ["x"]);
});

test("choosing indicators makes the block that suits them", () => {
  assert.equal(suggestVisualFor([], "CHART"), null);
  assert.equal(suggestVisualFor(["a"], "NUMBER")?.kind, "KPI");
  const one = suggestVisualFor(["a"], "CHART");
  assert.equal(one?.kind, "CHART");
  const many = suggestVisualFor(["a", "b", "c"], "CHART");
  assert.deepEqual((many?.props as { spec: { dataset: { indicatorIds: string[]; template: string } } }).spec.dataset.indicatorIds, ["a", "b", "c"]);
  assert.equal((many?.props as { spec: { dataset: { template: string } } }).spec.dataset.template, "INDICATORS_OVER_TIME");
  assert.equal((suggestVisualFor(["a", "b"], "COMPARE")?.props as { spec: { dataset: { template: string } } }).spec.dataset.template, "INDICATORS_PROGRESS");
  assert.equal(suggestVisualFor(["a", "b"], "TABLE")?.kind, "TABLE");
});
