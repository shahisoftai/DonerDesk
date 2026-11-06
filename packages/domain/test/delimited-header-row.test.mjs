import test from "node:test";
import assert from "node:assert/strict";
import { detectDelimiter, findHeaderRow } from "../dist/core/delimited.js";

test("detectDelimiter prefers tab, then comma, then semicolon", () => {
  assert.equal(detectDelimiter("a\tb,c;d"), "\t");
  assert.equal(detectDelimiter("a,b;c"), ",");
  assert.equal(detectDelimiter("a;b"), ";");
  assert.equal(detectDelimiter("plain text"), "");
});

test("findHeaderRow skips blanks, comments and delimiter-less lines", () => {
  const lines = ["", "# note", "just words", "Code, Title ,Type", "A1,x,y"];
  const found = findHeaderRow(lines, (h) => h.includes("code") && h.includes("title"));
  assert.deepEqual(found, { index: 3, delimiter: "," });
});

test("findHeaderRow gives the predicate normalised cells and returns null when none match", () => {
  const seen = [];
  const found = findHeaderRow(["Result Level,Item-Code"], (h) => (seen.push(h), false));
  assert.equal(found, null);
  assert.deepEqual(seen, [["resultlevel", "itemcode"]]);
});

test("findHeaderRow only looks at the first ten lines", () => {
  const lines = [...Array(10).fill("nothing"), "a,b"];
  assert.equal(findHeaderRow(lines, () => true), null);
});
