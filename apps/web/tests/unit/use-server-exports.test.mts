import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** A "use server" file may export only async functions (and types): anything else fails when the page that imports it is first opened, not when the app is built. */
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p] : []; });
}

test("every 'use server' file exports only async functions and types", () => {
  const bad: string[] = [];
  for (const f of files("src")) {
    const text = readFileSync(f, "utf8");
    if (!/^\s*["']use server["']/.test(text)) continue;
    for (const [i, line] of text.split("\n").entries()) {
      if (/^export\s+(const|let|var|class|enum)\s/.test(line) || /^export\s+default\s+(?!async)/.test(line) || /^export\s+function\s/.test(line)) bad.push(`${f}:${i + 1}: ${line.trim().slice(0, 80)}`);
    }
  }
  assert.deepEqual(bad, [], "move values to lib/server/schemas*.ts; only async functions may be exported from a use-server file");
});
