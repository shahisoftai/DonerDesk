import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Phase 44's structural rules, checked by reading the source (the same way the maps and setup features pin theirs): presentation never
 * reaches an adapter or a server action, the domain stays pure, one place knows each kind, files stay small, and a write has one door.
 */
const ROOT = "src/features/record";
const list = (dir: string): string[] => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? list(p) : /\.(ts|tsx)$/.test(n) ? [p] : []; });
const files = list(ROOT);
const read = (f: string) => readFileSync(f, "utf8");
const importsOf = (f: string): string[] => [...read(f).matchAll(/^\s*(?:import|export)\s[^;]*?from\s+["']([^"']+)["']/gm)].map((m) => m[1]!);
const inside = (dir: string) => files.filter((f) => f.startsWith(`${ROOT}/${dir}/`));

test("domain is pure: no React, no Next, no app aliases, no adapters or presentation", () => {
  const bad: string[] = [];
  for (const f of inside("domain")) for (const i of importsOf(f)) {
    if (/^(react|next)(\/|$)/.test(i) || i.startsWith("@/") || /\/(adapters|presentation|ports)\//.test(i) || i.includes("node:")) bad.push(`${f} imports ${i}`);
  }
  assert.deepEqual(bad, []);
});

test("presentation never imports an adapter or a server action: it gets everything from the composition", () => {
  const bad: string[] = [];
  for (const f of inside("presentation")) for (const i of importsOf(f)) {
    if (/\/adapters\//.test(i) || i.startsWith("@/lib/actions/")) bad.push(`${f} imports ${i}`);
  }
  assert.deepEqual(bad, []);
});

test("ports are interfaces only: no values, no imports of adapters", () => {
  for (const f of inside("ports")) {
    const text = read(f);
    assert.doesNotMatch(text, /^export\s+(const|let|var|function|class)\s/m, `${f} exports a value`);
    assert.deepEqual(importsOf(f).filter((i) => /\/adapters\//.test(i)), [], f);
  }
});

test("only the composition's sink reaches the quick-entry action", () => {
  const users = list("src").filter((f) => /\bquickEnterValueAction\b/.test(read(f)) && !f.endsWith("lib/actions/indicators.ts")).map((f) => relative(".", f));
  assert.deepEqual(users, ["src/features/record/composition.ts"]);
});

test("no code branches on a record kind's name outside the kinds table and its sibling tables", () => {
  const allowed = new Set([`${ROOT}/domain/record-kinds.ts`, `${ROOT}/domain/default-fields.ts`, `${ROOT}/domain/record-prefs.ts`, `${ROOT}/presentation/kind-views.ts`]);
  const bad: string[] = [];
  for (const f of files) {
    if (allowed.has(f)) continue;
    const text = read(f);
    if (/\.key\s*[!=]==?\s*["'](NUMBER|ACTIVITY|FILE|EXPENSE|FORM)["']/.test(text) || /case\s+["'](NUMBER|ACTIVITY|FILE|EXPENSE|FORM)["']\s*:/.test(text)) bad.push(f);
  }
  assert.deepEqual(bad, []);
});

test("every file stays under 300 lines and a presentation file exports at most one component", () => {
  for (const f of files) {
    const text = read(f);
    assert.ok(text.split("\n").length <= 300, `${f} is over 300 lines`);
    if (f.includes("/presentation/") && f.endsWith(".tsx")) {
      const components = [...text.matchAll(/^export\s+function\s+([A-Z]\w*)/gm)].length;
      assert.ok(components <= 1, `${f} exports ${components} components`);
    }
  }
});

test("the sheet reads its form from the views table, one view for every kind", async () => {
  const { RECORD_KINDS } = await import("../../src/features/record/domain/record-kinds.ts");
  const table = read(`${ROOT}/presentation/kind-views.ts`);
  for (const k of RECORD_KINDS) assert.match(table, new RegExp(`\\b${k.key}:`), `${k.key} has no view`);
});
