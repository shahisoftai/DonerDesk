import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A component class that is used but never defined fails silently: the element renders as plain text. `btn-primary` did exactly that
 * on the header "Enter data" button, so this test reads every `btn…` and `tag…` class used in a template and checks that
 * `globals.css` defines it.
 */
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? files(p) : /\.tsx$/.test(n) ? [p] : []; });
}

const css = readFileSync("src/app/globals.css", "utf8");
const defined = new Set([...css.matchAll(/\.((?:btn|tag)(?:-[a-z0-9]+)*)\b/g)].map((m) => m[1]!));

test("every btn-* and tag-* class used in a component is defined in globals.css", () => {
  const missing = new Map<string, string>();
  for (const f of files("src")) {
    const text = readFileSync(f, "utf8");
    // Only lines that set classes (className, class=, cn(…)): an id or an aria-labelledby value is not a class.
    for (const line of text.split("\n")) {
      if (!/className|class=|\bcn\(/.test(line)) continue;
      const classy = line.replace(/\b(?:id|aria-labelledby|aria-describedby|htmlFor|href|name|key|data-[\w-]+)="[^"]*"/g, "");
      for (const m of classy.matchAll(/(?<![\w-])((?:btn|tag)(?:-[a-z0-9]+)+)(?![\w-])/g)) {
        const name = m[1]!;
        if (!defined.has(name) && !missing.has(name)) missing.set(name, f);
      }
    }
  }
  assert.deepEqual([...missing].map(([name, file]) => `${name} (${file})`), [], "define the class in globals.css or use one that exists");
});

test("the primary button class exists", () => {
  assert.ok(defined.has("btn-primary"));
  assert.ok(defined.has("btn-secondary"));
});
