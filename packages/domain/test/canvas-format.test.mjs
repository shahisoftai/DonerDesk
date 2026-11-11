import test from "node:test";
import assert from "node:assert/strict";
import { BLOCK_KINDS, FORMAT_CAPABILITIES, CAPABILITY_DEFS, FAMILY_FORMATS, BLOCK_FAMILIES, formatsOf, formatProblems, formatFigure, conditionalEffect, conditionalProblems, formatHints, roleColour, COLOUR_ROLES, themeFor, canvasStructureProblems } from "../dist/index.js";

const theme = themeFor("DEFAULT");
const hex = (c) => ("hex" in c ? c.hex : roleColour(theme, c.role));

test("every capability has a checker and a label key, and every family names only known capabilities", () => {
  for (const k of FORMAT_CAPABILITIES) { assert.equal(typeof CAPABILITY_DEFS[k].check, "function", k); assert.equal(CAPABILITY_DEFS[k].labelKey, `format.${k}`); }
  for (const f of BLOCK_FAMILIES) for (const c of FAMILY_FORMATS[f]) assert.ok(FORMAT_CAPABILITIES.includes(c), `${f}:${c}`);
  for (const k of BLOCK_KINDS) assert.ok(formatsOf(k).includes("visibility"), `${k} can at least be hidden`);
});

test("a capability the block does not offer is refused, an unknown one too", () => {
  assert.match(formatProblems("TEXT", { table: { banded: true } })[0], /no "table"/);
  assert.match(formatProblems("TEXT", { wobble: {} })[0], /not a formatting option/);
  assert.deepEqual(formatProblems("KPI", { accentBar: { show: true, side: "start", thickness: 6, color: { role: "accent" } } }), []);
  assert.ok(formatProblems("KPI", { accentBar: { show: true, side: "middle", thickness: 40, color: { hex: "red" } } }).length >= 3);
});

test("numbers: a gap stays a gap, units and negatives are written as asked", () => {
  assert.equal(formatFigure(null), null);
  assert.equal(formatFigure(0), "0");
  assert.equal(formatFigure(2542159, { units: "NONE" }), "2,542,159");
  assert.equal(formatFigure(2542159), "2.5M");
  assert.equal(formatFigure(9999), "9,999");
  assert.equal(formatFigure(-1500, { units: "K", negative: "parentheses" }), "(1.5K)");
  assert.equal(formatFigure(12.5, { suffix: "%", decimals: 1 }), "12.5%");
  assert.equal(formatFigure(1234, { units: "NONE" }, "ar"), "1,234", "Latin digits in Arabic");
});

test("conditional: a missing value is never coloured; first band wins; gradient spans the range", () => {
  const rules = [{ kind: "RULES", target: "background", bands: [{ op: "LT", value: 50, color: { role: "bad" } }, { op: "GTE", value: 50, color: { role: "good" } }] }];
  assert.equal(conditionalEffect(null, rules, null, hex), null);
  assert.deepEqual(conditionalEffect(10, rules, null, hex).color, { role: "bad" });
  assert.deepEqual(conditionalEffect(0, rules, null, hex).color, { role: "bad" }, "a real 0 is a value");
  const g = [{ kind: "GRADIENT", target: "background", min: { hex: "#000000" }, max: { hex: "#ffffff" } }];
  assert.equal(conditionalEffect(0, g, { min: 0, max: 10 }, hex).color.hex, "#000000");
  assert.equal(conditionalEffect(10, g, { min: 0, max: 10 }, hex).color.hex, "#ffffff");
  const bars = [{ kind: "DATA_BARS", color: { role: "accent" } }];
  assert.equal(conditionalEffect(5, bars, { min: -3, max: 10 }, hex).bar.share, 0.5);
  assert.equal(conditionalEffect(-3, bars, { min: -3, max: 10 }, hex).bar.share, 0, "no bar below zero");
});

test("conditional: problems are plain, and a rate is never a data bar", () => {
  assert.deepEqual(conditionalProblems([{ kind: "DATA_BARS", color: { role: "accent" } }], { isRate: false }), []);
  assert.match(conditionalProblems([{ kind: "DATA_BARS", color: { role: "accent" } }], { isRate: true })[0], /rate/);
  assert.ok(conditionalProblems([{ kind: "RULES", target: "text", bands: [{ op: "BETWEEN", value: 1, color: { role: "good" } }] }], { isRate: false }).some((p) => /both ends/.test(p)));
  assert.ok(conditionalProblems([{ kind: "ICONS", bands: [{ op: "GT", value: 1, color: { role: "good" } }] }], { isRate: false }).some((p) => /icon/.test(p)));
});

test("hints: every role resolves to a colour; the accent bar and one-side border come through", () => {
  for (const r of COLOUR_ROLES) assert.match(roleColour(theme, r), /^#[0-9a-f]{6}$/i, r);
  const h = formatHints({ accentBar: { show: true, side: "start", thickness: 6, color: { role: "accent" } }, frame: { borderSide: "top", borderWidth: 4 } }, theme);
  assert.deepEqual(h.accentBar, { side: "start", px: 6, colour: theme.accent });
  assert.equal(h.border.side, "top");
  assert.equal(formatHints(undefined, theme).accentBar, null);
});

test("a canvas with a bad format fails its structure check", () => {
  const canvas = { id: "c", scope: "PROJECT", mode: "LIVE", profile: "INTERNAL", title: "T", language: "en", themeId: "DEFAULT", revision: 1, pages: [{ id: "p", title: "P", format: "WEB_FLUID", blocks: [{ id: "b", kind: "TEXT", bounds: { x: 0, y: 0, w: 4, h: 1 }, props: { text: "x" }, bindings: [], format: { table: {} } }] }] };
  const r = canvasStructureProblems(canvas);
  assert.ok(r.some((p) => p.blockId === "b" && /no "table"/.test(p.message)));
});
