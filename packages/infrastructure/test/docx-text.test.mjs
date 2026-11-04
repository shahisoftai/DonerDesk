import assert from "node:assert/strict";
import test from "node:test";
import { docxHtmlToText } from "../dist/parsers/docx-text.js";
import { detectHeading } from "../dist/project-setup/document-map.js";

test("a table row stays one line, with empty middle cells kept and trailing ones dropped", () => {
  const html = "<p>Intro &amp; more</p><table><tr><td><p>Code</p></td><td><p>Target</p></td></tr><tr><td><p>1.1</p></td><td></td><td><p>0</p></td><td></td></tr></table>";
  assert.equal(docxHtmlToText(html), "Intro & more\n\nCode | Target\n1.1 |  | 0");
});

test("a layout table around a section gives its lines, and a nested table keeps its rows", () => {
  const html = "<table><tr><td><p>Section</p><table><tr><td><p>Label</p></td><td><p>Value</p></td></tr></table></td></tr></table>";
  assert.match(docxHtmlToText(html), /Section\n+Label \| Value/);
});

test("a row whose cells hold several paragraphs loses nothing", () => {
  const text = docxHtmlToText("<table><tr><td><p>A</p><p>B</p></td><td><p>C</p></td></tr></table>");
  for (const w of ["A", "B", "C"]) assert.ok(text.includes(w));
});

test("a table row is a heading only for a numbered label, named without its value", () => {
  assert.equal(detectHeading("1.1 Allocation Window | Standard", true)?.title, "1.1 Allocation Window");
  assert.equal(detectHeading("Project code | CBPF-1", true), null);
});
