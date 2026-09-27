import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveExtensions } from "@tiptap/core";
import { MarkdownManager } from "@tiptap/markdown";
import { reportEditorExtensions } from "../../src/features/report-editor/rich-text/extensions.ts";
import {
  canonicalSectionMarkdown,
  compactTables,
  decodeSerializerEntities,
  toStorageMarkdown,
  unescapeSerializerOutput,
} from "../../src/features/report-editor/rich-text/markdown-io.ts";

/**
 * Golden round-trip gate for the rich-text editor: opening a section in the
 * editor and saving it without edits must reproduce the stored text exactly
 * (canonical form), otherwise every open would create a spurious revision and
 * shift the verifier's claim offsets.
 */
const manager = new MarkdownManager({ extensions: resolveExtensions(reportEditorExtensions()), indentation: { style: "space", size: 2 } });
const roundTrip = (md: string) => toStorageMarkdown(manager.serialize(manager.parse(md)));

const RICH_CORPUS = [
  "Households reached **1,680** of the *2,000* target (84%).\n\nSecond paragraph with `code` and [the log](https://example.org/log).",
  "### Key results\n\n- Boreholes rehabilitated\n- Latrines built\n  - 12 in District A\n  - 8 in District B\n\n1. Training delivered\n2. Committees formed\n\n> Community feedback was positive.",
  "| Indicator | Target | Achieved | % of target |\n| --- | --- | --- | --- |\n| OUT-1 Households with safe water | 2,000 | 1,680 | 84% |\n| OUT-2 Latrines constructed | 400 | 248 | 62% |",
  "#### Variance\n\nLatrine construction reached 62% of target because flooding cut access for three weeks.",
  "Children <5 years & adults > 18 received support; 2 * 3 sessions ran. File a_b_c.xlsx and #hashtag stayed literal.",
  "Expenditure reached EUR 240,000 against a budget of EUR 300,000 — an underspend of EUR 60,000 (20%). \"Quoted\" and 'single' text.",
  "A paragraph\nwith a soft line break.",
];

function goldenDrafts(): string[] {
  const path = join(import.meta.dirname, "../../../../packages/infrastructure/test/fixtures/reporting-golden.json");
  const data = JSON.parse(readFileSync(path, "utf8")) as { cases: Array<{ draftText?: string }> };
  return data.cases.map((c) => c.draftText ?? "").filter((t) => t.trim().length > 0);
}

test("every corpus section round-trips through the editor unchanged", () => {
  const corpus = [...RICH_CORPUS, ...goldenDrafts()];
  assert.ok(corpus.length >= 10, "corpus should include the golden drafts");
  for (const md of corpus) {
    const canonical = canonicalSectionMarkdown(md);
    assert.equal(roundTrip(canonical), canonical, `round-trip changed:\n${md}`);
  }
});

test("round-trip is stable on its own output", () => {
  for (const md of RICH_CORPUS) {
    const once = roundTrip(canonicalSectionMarkdown(md));
    assert.equal(roundTrip(once), once);
  }
});

test("AI tables without spaced separators become canonical once", () => {
  assert.equal(compactTables("|A|B|\n|---|:---:|\n|1|2|"), "| A | B |\n| --- | --- |\n| 1 | 2 |");
  assert.equal(canonicalSectionMarkdown("|A|B|\n|---|---|\n|1|2|"), "| A | B |\n| --- | --- |\n| 1 | 2 |");
});

test("entities and escapes from the serializer are undone", () => {
  assert.equal(decodeSerializerEntities("a &lt;5 &amp; b &gt; c &amp;lt;"), "a <5 & b > c &lt;");
  assert.equal(unescapeSerializerOutput("cost \\* 2, a\\_b, \\#tag, 1\\. item, a\\*b"), "cost * 2, a_b, #tag, 1. item, a\\*b");
});

test("formatting produced in the editor serialises to the supported subset", () => {
  const doc = {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Results" }] },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Bold", marks: [{ type: "bold" }] },
          { type: "text", text: " and " },
          { type: "text", text: "italic", marks: [{ type: "italic" }] },
          { type: "text", text: " and " },
          { type: "text", text: "link", marks: [{ type: "link", attrs: { href: "https://x.org" } }] },
        ],
      },
      {
        type: "bulletList",
        content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Item" }] }] }],
      },
    ],
  };
  assert.equal(toStorageMarkdown(manager.serialize(doc)), "### Results\n\nBold and *italic* and [link](https://x.org)\n\n- Item".replace("Bold and", "**Bold** and"));
});

import { cleanPastedHtml } from "../../src/features/report-editor/rich-text/paste-cleanup.ts";

test("paste cleanup maps headings and strips Word noise", () => {
  const word =
    '<!--[if gte mso 9]><xml>junk</xml><![endif]--><style>p{color:red}</style><meta charset="utf-8">' +
    '<h1 class="MsoTitle">Title</h1><h2>Sub</h2><h5>Small</h5><p class="MsoNormal">Text<o:p></o:p></p><img src="x.png"><!-- c -->';
  assert.equal(cleanPastedHtml(word), "<h3>Title</h3><h3>Sub</h3><h4>Small</h4><p class=\"MsoNormal\">Text</p>");
});
