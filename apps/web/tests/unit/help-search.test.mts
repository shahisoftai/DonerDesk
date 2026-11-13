import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { HELP_ARTICLES } from "../../src/features/help/domain/help-index.ts";
import { rankHelp, helpWords } from "../../src/features/help/domain/help-rank.ts";

const root = join(import.meta.dirname, "..", "..", "content", "support");
const walk = (dir: string, base = ""): string[] => readdirSync(join(dir, base), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(dir, join(base, e.name)) : [join(base, e.name)]));

test("every support article is in the help index and every indexed file exists", () => {
  const files = walk(root).filter((f) => f.endsWith(".md") && f !== "INDEX.md");
  const indexed = new Set(HELP_ARTICLES.map((a) => a.file));
  assert.deepEqual(files.filter((f) => !indexed.has(f)), []);
  assert.deepEqual([...indexed].filter((f) => !files.includes(f)), []);
});

const docs = [
  { href: "/support/a", title: "Plans and limits", headings: ["Active projects"], body: "Your plan sets limits on projects, seats and storage. Reaching a limit stops new projects." },
  { href: "/support/b", title: "Verify evidence", headings: ["Who can verify"], body: "A reviewer verifies a file once it is readable. Verified files can be cited." },
];

test("a title word outranks a text word, and nothing matching finds nothing", () => {
  assert.equal(rankHelp("how many projects does my plan allow", docs)[0]?.href, "/support/a");
  assert.equal(rankHelp("verify a file", docs)[0]?.href, "/support/b");
  assert.deepEqual(rankHelp("zebra", docs), []);
  assert.deepEqual(rankHelp("how do I the", docs), []);
  assert.deepEqual(helpWords("Hello, hello WORLD!"), ["hello", "world"]);
});
