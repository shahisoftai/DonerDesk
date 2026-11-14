import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { RETIRED_TERMS } from "../../src/features/design/domain/ux-glossary.ts";

/**
 * No user-visible string uses a retired name (plan F38). Comments are not scanned; the i18n key `nav.myWork` keeps old pages working.
 * A string that explains the change ("the old Report builder", "replaces My Work", "was Report builder") is allowed: people search by the old name.
 */
const EXPLAINS = /\b(old|older|replaces|replaced|was|formerly|before Version 4)\b/i;
const SRC = join(process.cwd(), "src");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const f = join(dir, n);
    if (statSync(f).isDirectory()) return files(f);
    return /\.tsx?$/.test(n) && !f.includes("ux-glossary.ts") ? [f] : [];
  });
}

const visible = (text: string): string[] => {
  const noComments = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const strings = [...noComments.matchAll(/"([^"\n]*)"|`([^`]*)`|>([^<>{}\n]+)</g)].map((m) => m[1] ?? m[2] ?? m[3] ?? "");
  return strings;
};

test("no retired word appears in a user-visible string", () => {
  const hits: string[] = [];
  for (const f of files(SRC)) {
    const rel = relative(SRC, f);
    for (const s of visible(readFileSync(f, "utf8"))) {
      for (const t of RETIRED_TERMS) if (t.retired.test(s) && !/^nav\./.test(s) && !EXPLAINS.test(s)) hits.push(`${rel}: "${s.slice(0, 60)}" → use "${t.use}"`);
    }
  }
  assert.deepEqual(hits, []);
});
