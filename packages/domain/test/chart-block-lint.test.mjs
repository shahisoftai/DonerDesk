import assert from "node:assert/strict";
import test from "node:test";
import { chartBlock } from "../dist/contexts/canvas/blocks/chart.js";
import { spec } from "./support/chart-fixtures.mjs";

const rule = (id) => chartBlock.lint.find((r) => r.id === id);
const many = (over = {}) => spec("BAR_GROUPED", "INDICATORS_OVER_TIME", ["a", "b", "c", "n", "w"], over);

test("five or more colours without patterns is a tip; patterns, or fewer colours, clear it", () => {
  const r = rule("CHART_MANY_COLOURS_NO_PATTERN");
  assert.equal(r.severity, "TIP");
  assert.match(r.check({ spec: many() }), /Patterns as well as colour/);
  assert.equal(r.check({ spec: many({ style: { effects: { decals: true } } }) }), null);
  assert.equal(r.check({ spec: spec("BAR_GROUPED", "INDICATORS_OVER_TIME", ["a", "b"]) }), null);
  assert.equal(r.check({ spec: undefined }), null, "a chart not set up yet is not judged here");
});

test("a chosen colour too pale for a white page is a warning that names it", () => {
  const r = rule("CHART_COLOUR_TOO_PALE");
  assert.equal(r.severity, "WARN");
  assert.match(r.check({ spec: spec("BAR", "INDICATOR_OVER_TIME", ["a"], { colors: ["#ffff99", "#0b3c5d"] }) }), /#ffff99/);
  assert.match(r.check({ spec: spec("BAR", "INDICATOR_OVER_TIME", ["a"], { series: [{ index: 0, color: "#eeeeee" }] }) }), /#eeeeee/);
  assert.equal(r.check({ spec: spec("BAR", "INDICATOR_OVER_TIME", ["a"], { colors: ["#0b3c5d"] }) }), null);
  assert.equal(r.check({ spec: spec("BAR", "INDICATOR_OVER_TIME", ["a"]) }), null);
});
