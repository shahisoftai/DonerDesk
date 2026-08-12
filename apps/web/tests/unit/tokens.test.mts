import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("globals.css implements reduced-motion behavior", () => {
  const css = readFileSync(join(import.meta.dirname, "..", "..", "src", "app", "globals.css"), "utf8");
  assert.match(css, /prefers-reduced-motion/);
});

test("globals.css implements visible focus styling", () => {
  const css = readFileSync(join(import.meta.dirname, "..", "..", "src", "app", "globals.css"), "utf8");
  assert.match(css, /:focus-visible/);
});
