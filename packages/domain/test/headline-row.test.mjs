import test from "node:test";
import assert from "node:assert/strict";
import { headlinePicks, mobileRows, MOBILE_HEIGHT_BY_KIND, WIDGET_HEIGHT_KINDS, HEADLINE_MAX } from "../dist/index.js";

const role = (key, required) => ({ key, label: key, hint: "", keywords: [], types: ["ANY"], required });

test("the headline row takes mapped roles, required first, never twice the same indicator, at most four", () => {
  const roles = [role("a", false), role("b", true), role("c", true), role("d", false), role("e", false), role("f", false)];
  const mapping = { a: "i1", b: "i2", c: "i2", d: "i3", e: "i4", f: "i5" };
  const picks = headlinePicks(roles, mapping, 4);
  assert.deepEqual(picks.map((p) => p.indicatorId), ["i2", "i1", "i3", "i4"]);
  assert.equal(picks.length, HEADLINE_MAX);
  assert.deepEqual(picks.map((p) => p.x), [0, 3, 6, 9]);
  assert.equal(picks.reduce((n, p) => n + p.w, 0), 12);
});
test("an unmapped role gets no tile, nothing mapped gives no row, and a full dashboard has no room", () => {
  assert.deepEqual(headlinePicks([role("a", true)], {}, 3), []);
  const three = headlinePicks([role("a", true), role("b", true), role("c", true)], { a: "1", b: "2", c: "3" }, 3);
  assert.deepEqual(three.map((p) => p.w), [4, 4, 4]);
  assert.deepEqual(headlinePicks([role("a", true)], { a: "1" }, 24), []);
});
test("on a phone a tall chart is capped and a tiny one lifted; every widget kind has a rule", () => {
  assert.equal(mobileRows("CHART", 8), 4);
  assert.equal(mobileRows("KPI", 2), 2);
  assert.equal(mobileRows("TEXT", 1), 1);
  assert.equal(mobileRows(undefined, 6), 4);
  assert.deepEqual(Object.keys(MOBILE_HEIGHT_BY_KIND).sort(), [...WIDGET_HEIGHT_KINDS].sort());
});
