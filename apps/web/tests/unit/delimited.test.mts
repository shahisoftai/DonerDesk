import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDelimited } from "../../src/lib/shared/delimited.ts";

test("tab-separated text from a spreadsheet copy keeps commas inside amounts", () => {
  assert.deepEqual(parseDelimited("Staff\t6,000\t2,000\nSupplies\t4,000\t1,250.50"), [["Staff", "6,000", "2,000"], ["Supplies", "4,000", "1,250.50"]]);
});

test("comma-separated text with quoted amounts", () => {
  assert.deepEqual(parseDelimited('Budget line,Budget,Spent\n"Staff, core","6,000",2000'), [["Budget line", "Budget", "Spent"], ["Staff, core", "6,000", "2000"]]);
});

test("escaped quotes, semicolon files, blank lines and Windows newlines", () => {
  assert.deepEqual(parseDelimited('"Say ""hi""",1'), [['Say "hi"', "1"]]);
  assert.deepEqual(parseDelimited("a;b;c\r\n\r\nd;e;f\r\n"), [["a", "b", "c"], ["d", "e", "f"]]);
  assert.deepEqual(parseDelimited(""), []);
  assert.deepEqual(parseDelimited("   \n  "), []);
});

test("a plain comma file splits on commas and trims cells", () => {
  assert.deepEqual(parseDelimited("a , b ,c"), [["a", "b", "c"]]);
});
