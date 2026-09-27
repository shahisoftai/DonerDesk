import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeSectionMarkdown,
  sectionMarkdownEquivalent,
  SECTION_MARKDOWN_MAX_LENGTH,
} from "../dist/contexts/reporting/section-markdown.js";

test("line endings, trailing spaces and blank-line runs are canonicalised", () => {
  assert.equal(normalizeSectionMarkdown("\r\n\r\nA line   \r\n\r\n\r\n\r\nB\t\r\n\n"), "A line\n\nB");
});

test("raw HTML is removed, <br> becomes a line break, comments vanish", () => {
  assert.equal(
    normalizeSectionMarkdown('Hello <span style="color:red">world</span><br/>next <!-- hidden -->line <script>x()</script>'),
    "Hello world\nnext line x()",
  );
});

test("comparison operators and plain angle text survive", () => {
  assert.equal(normalizeSectionMarkdown("Children <5 years and adults > 18"), "Children <5 years and adults > 18");
});

test("images reduce to their alt text", () => {
  assert.equal(normalizeSectionMarkdown("See ![Map of district](http://x/m.png) above."), "See Map of district above.");
});

test("headings are limited to the section levels (### and ####)", () => {
  assert.equal(normalizeSectionMarkdown("# Top\n## Second\n###   Third\n#### Four\n###### Six"), "### Top\n### Second\n### Third\n#### Four\n#### Six");
  assert.equal(normalizeSectionMarkdown("#hashtag stays text"), "#hashtag stays text");
});

test("supported markdown is untouched", () => {
  const md = "Reached **1,680** of *2,000*.\n\n- One\n  - Nested\n1. First\n\n> Quote\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n[log](https://x.org) and `code`";
  assert.equal(normalizeSectionMarkdown(md), md);
});

test("idempotent and zero-width characters removed", () => {
  const messy = "﻿Title​ text  \n\n\n\n# H\r\n<b>bold</b>";
  const once = normalizeSectionMarkdown(messy);
  assert.equal(normalizeSectionMarkdown(once), once);
  assert.equal(once, "Title text\n\n### H\nbold");
});

test("equivalence ignores formatting-only differences", () => {
  assert.ok(sectionMarkdownEquivalent("A\r\n\r\n\r\nB  ", "A\n\nB"));
  assert.ok(!sectionMarkdownEquivalent("A", "B"));
  assert.equal(SECTION_MARKDOWN_MAX_LENGTH, 100000);
});
