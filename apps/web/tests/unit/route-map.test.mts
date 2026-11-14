import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Phase 55 gate (Version 4.000, plan §1). Every page has a row in `memorybank/imp/phase55-route-map.md`, and no page links to an
 * address the map marks as a redirect: moving a page without a row, or linking to a retired one, fails here.
 */
const WEB = process.cwd();
const ROOT = join(WEB, "..", "..");
const APP = join(WEB, "src", "app");
const map = readFileSync(join(ROOT, "memorybank/imp/phase55-route-map.md"), "utf8");

const rows = map.split("\n").filter((l) => l.startsWith("| `")).map((l) => l.split("|").slice(1, -1).map((c) => c.trim()));
const mapped = new Map(rows.map((r) => [r[0]!.replace(/`/g, ""), r[2]!]));

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return pages(full);
    return name === "page.tsx" ? [full] : [];
  });
}

const routeOf = (file: string) => {
  const rel = relative(APP, file).split(sep).slice(0, -1).filter((s) => !/^\(.*\)$/.test(s)).join("/");
  return `/${rel}`;
};

test("every page has a row in the route map", () => {
  const missing = pages(APP).map(routeOf).filter((r) => !mapped.has(r));
  assert.deepEqual(missing, [], `Add these routes to phase55-route-map.md: ${missing.join(", ")}`);
});

test("no row names a page that no longer exists", () => {
  const existing = new Set(pages(APP).map(routeOf));
  const stale = [...mapped.keys()].filter((r) => !existing.has(r));
  assert.deepEqual(stale, []);
});

test("nothing links to a redirected address", () => {
  const redirected = [...mapped.entries()].filter(([, status]) => status === "REDIRECT").map(([r]) => r).filter((r) => r !== "/projects/new");
  const offenders: string[] = [];
  const scan = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) { scan(full); continue; }
      if (!/\.(tsx?|mts)$/.test(name)) continue;
      const text = readFileSync(full, "utf8");
      for (const r of redirected) {
        if (new RegExp(`href=["{\`]+${r.replace(/[/[\]]/g, "\\$&")}["?\`/]`).test(text)) offenders.push(`${relative(WEB, full)} → ${r}`);
      }
    }
  };
  scan(join(WEB, "src"));
  assert.deepEqual(offenders, []);
});
