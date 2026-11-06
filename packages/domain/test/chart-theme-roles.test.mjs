import test from "node:test";
import assert from "node:assert/strict";
import { DARK_ROLES, LIGHT_ROLES, THEME_ROLES, retheme } from "../dist/contexts/reporting/chart-theme-roles.js";

test("every role has a light and a dark value", () => {
  for (const r of THEME_ROLES) { assert.ok(LIGHT_ROLES[r], r); assert.ok(DARK_ROLES[r], r); }
});

test("retheme swaps role colours, leaves other colours and functions alone, and does not mutate", () => {
  const fmt = () => "x";
  const option = { a: { fill: LIGHT_ROLES.text, own: "#123456", list: [LIGHT_ROLES.positive, "#FFF"], formatter: fmt } };
  const copy = JSON.stringify(option);
  const out = retheme(option, DARK_ROLES);
  assert.equal(out.a.fill, DARK_ROLES.text);
  assert.equal(out.a.own, "#123456");
  assert.deepEqual(out.a.list, [DARK_ROLES.positive, DARK_ROLES.surface]);
  assert.equal(out.a.formatter, fmt);
  assert.equal(JSON.stringify(option), copy);
});

test("retheme to the same map returns the same object", () => {
  const o = { c: LIGHT_ROLES.text };
  assert.equal(retheme(o, LIGHT_ROLES), o);
});

import { splitEmbeddedTitle } from "../dist/contexts/reporting/chart-theme-roles.js";

test("splitEmbeddedTitle removes the title, returns the subtitle and leaves the rest and the original alone", () => {
  const o = { title: { text: "T", subtext: " Sub " }, series: [1] };
  const r = splitEmbeddedTitle(o);
  assert.equal(r.subtitle, "Sub");
  assert.deepEqual(r.option, { series: [1] });
  assert.equal(o.title.text, "T");
  assert.deepEqual(splitEmbeddedTitle({ series: [] }), { option: { series: [] }, subtitle: undefined });
});
