import test from "node:test";
import assert from "node:assert/strict";
import { tabsOf, widgetsOnTab, widgetProblems, MAX_TABS } from "../dist/index.js";

const w = (id, tab, y = 0, x = 0) => ({ id, projectId: "p", kind: "TEXT", text: "t", tab, x, y, w: 4, h: 2 });

test("tabs are listed in reading order without repeats; unnamed widgets are the first tab", () => {
  const ws = [w("a", "Health", 4), w("b", undefined, 0), w("c", "Nutrition", 2), w("d", "Health", 6)];
  assert.deepEqual(tabsOf(ws), ["Nutrition", "Health"]);
  assert.deepEqual(widgetsOnTab(ws, "").map((x) => x.id), ["b"]);
  assert.deepEqual(widgetsOnTab(ws, "Health").map((x) => x.id), ["a", "d"]);
});

test("tab names are checked", () => {
  assert.equal(widgetProblems([w("a", "  ")]).length, 1);
  assert.equal(widgetProblems([w("a", "x".repeat(41))]).length, 1);
  const many = Array.from({ length: MAX_TABS + 1 }, (_, i) => w(`w${i}`, `T${i}`, i * 2));
  assert.ok(widgetProblems(many).some((p) => /tabs/.test(p.message)));
});

test("a report widget carries its question and is checked with the report rules", () => {
  const base = { id: "r", projectId: "p", kind: "REPORT", x: 0, y: 0, w: 6, h: 4 };
  assert.deepEqual(widgetProblems([{ ...base, report: { indicatorIds: ["a"], measure: "PERIOD", rows: "INDICATOR", includeDraft: true } }]), []);
  assert.equal(widgetProblems([{ ...base }]).length, 1, "no question");
  assert.equal(widgetProblems([{ ...base, report: { indicatorIds: [], measure: "PERIOD", rows: "INDICATOR", includeDraft: true } }]).length, 1);
});
