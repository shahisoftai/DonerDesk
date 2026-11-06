import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * A Server Component cannot hand a function to a Client Component: it fails when the page renders, not when it compiles,
 * so neither `tsc` nor `next build` notices. Pages that run on the server must pass plain data (ids, booleans, strings).
 */
const APP = join(import.meta.dirname, "../../src/app");
const FUNCTION_PROP = /\b[A-Za-z]\w*=\{\s*(?:async\s*)?\(?[\w,\s{}]*\)?\s*=>/;

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return pages(path);
    return /^(page|layout)\.tsx$/.test(name) ? [path] : [];
  });
}

test("server pages pass data, never functions, to the components they render", () => {
  const offenders: string[] = [];
  for (const file of pages(APP)) {
    const text = readFileSync(file, "utf8");
    if (/^\s*["']use client["']/m.test(text)) continue; // a client page may use callbacks freely
    text.split("\n").forEach((line, i) => {
      if (FUNCTION_PROP.test(line)) offenders.push(`${relative(APP, file)}:${i + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(offenders, []);
});
