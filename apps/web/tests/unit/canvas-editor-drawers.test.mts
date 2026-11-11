import assert from "node:assert/strict";
import test from "node:test";
import { FORMAT_CAPABILITIES, BLOCK_KINDS, formatsOf, formatProblems, setBlockFormat, sharedCapabilities, blankCanvas, addBlock, decodeFilterSelection, encodeFilterSelection, NO_FILTER, COLOUR_ROLES, FILTER_DIMENSIONS, CONDITIONAL_KINDS, RULE_OPERATORS, CONDITIONAL_ICONS, TOTAL_FUNCTIONS, INTERACTION_EFFECTS } from "@donordesk/domain/contexts/canvas/index.js";
import { MESSAGES } from "../../src/features/i18n/messages/index.ts";
import { FORMAT_SECTIONS, formatMessageKeys } from "../../src/features/canvas/editor/domain/format-sections.ts";
import { parseDrawerPrefs, defaultDrawerPrefs, pinnedWidth, DRAWER_MAX, EDIT_TABS } from "../../src/features/canvas/editor/domain/drawer-state.ts";
import { matchSections } from "../../src/features/canvas/editor/domain/field-search.ts";
import { pointToCell } from "../../src/features/canvas/editor/domain/drop-cell.ts";
import { STARTER_SETS } from "../../src/features/canvas/editor/domain/starters.ts";
import { toSelection, fromSelection } from "../../src/features/canvas/filters/selection-bridge.ts";
import { setAt } from "../../src/features/canvas/domain/path.ts";
import { PROP_FIELDS, afterChange } from "../../src/features/canvas/domain/prop-fields.ts";
import { frameCss } from "../../src/features/canvas/domain/format-style.ts";

test("every formatting capability has a section, and every section field writes a setting its capability accepts", () => {
  for (const c of FORMAT_CAPABILITIES) assert.ok(FORMAT_SECTIONS[c], c);
  const probe: Record<string, unknown> = { toggle: true, select: undefined, number: 1, slider: 4, text: "x", color: { role: "accent" }, padding: { top: 4, end: 4, bottom: 4, start: 4 }, conditional: [], columns: [], indicators: [] };
  for (const c of FORMAT_CAPABILITIES) {
    const kind = BLOCK_KINDS.find((k) => formatsOf(k).includes(c));
    assert.ok(kind, `some block offers ${c}`);
    for (const f of FORMAT_SECTIONS[c].fields) {
      const value = f.type === "select" ? f.options[0]!.value : f.type === "number" ? f.min : probe[f.type];
      const settings = setAt({}, f.path, value);
      assert.deepEqual(formatProblems(kind!, { [c]: settings } as never), [], `${c}.${f.path}`);
    }
  }
});

test("every word the editor shows is translated in every language", () => {
  const keys = [...formatMessageKeys(), ...EDIT_TABS.map((k) => `tab.${k}`), ...COLOUR_ROLES.map((r) => `color.role.${r}`), ...FILTER_DIMENSIONS.map((d) => `filter.${d}`), ...CONDITIONAL_KINDS.map((k) => `rules.kind.${k}`), ...RULE_OPERATORS.map((o) => `rules.op.${o}`), ...CONDITIONAL_ICONS.map((i) => `rules.icon.${i}`), ...TOTAL_FUNCTIONS.map((f) => `cols.total.${f}`), ...INTERACTION_EFFECTS.map((e) => `inter.${e}`), ...STARTER_SETS.map((s) => s.labelKey), "canvas.block.MULTI_CARD"];
  for (const [lang, cat] of Object.entries(MESSAGES)) for (const k of keys) assert.ok(typeof (cat as Record<string, string>)[k] === "string" && (cat as Record<string, string>)[k]!.length > 0, `${lang}: ${k}`);
});

test("drawer preferences are read defensively and pinned drawers take their width", () => {
  assert.deepEqual(parseDrawerPrefs("not json", 1200), defaultDrawerPrefs(1200));
  assert.equal(parseDrawerPrefs('{"editWidth": 99999, "tab": "NOPE"}', 1600).editWidth, DRAWER_MAX);
  assert.equal(parseDrawerPrefs('{"tab": "FORMAT"}', 1600).tab, "FORMAT");
  assert.equal(defaultDrawerPrefs(1440).pinned, true);
  assert.equal(defaultDrawerPrefs(1024).pinned, false);
  assert.equal(pinnedWidth({ ...defaultDrawerPrefs(1600), addOpen: true }), 280 + 360);
  assert.equal(pinnedWidth({ ...defaultDrawerPrefs(1000) }), 0);
});

test("format search shows a whole section by its name, else only the fields that match", () => {
  const label = (k: string) => (MESSAGES.en as Record<string, string>)[k] ?? k;
  const all = Object.values(FORMAT_SECTIONS);
  assert.deepEqual(matchSections(all, "accent", label).map((s) => s.capability).includes("accentBar"), true);
  const dec = matchSections(all, "decimal", label);
  assert.equal(dec.length, 1); assert.equal(dec[0]!.fields.length, 1);
  assert.equal(matchSections(all, "", label).length, all.length);
});

test("a dropped block lands in the cell under the pointer, clamped to the grid", () => {
  const grid = { left: 0, top: 0, width: 1188, offsetWidth: 1188 };
  assert.deepEqual(pointToCell({ x: 5, y: 5 }, grid, 16), { x: 0, y: 0 });
  assert.deepEqual(pointToCell({ x: 600, y: 200 }, grid, 16), { x: 6, y: 2 });
  assert.deepEqual(pointToCell({ x: 99999, y: -50 }, grid, 16), { x: 11, y: 0 });
});

test("formatting several blocks is one step, skips what cannot take it, and refuses a bad value", () => {
  let c = blankCanvas({ id: "c", title: "T", scope: "MINE" });
  for (const [id, kind] of [["a", "MULTI_CARD"], ["b", "TEXT"], ["d", "CHART"]] as const) { const r = addBlock(c, "page-1", { id, kind }); assert.ok(r.ok); c = r.canvas; }
  const r = setBlockFormat(c, ["a", "b", "d"], "accentBar", { show: true, side: "start", thickness: 6, color: { role: "accent" } });
  assert.ok(r.ok);
  assert.deepEqual(r.skipped, ["d"], "a chart has no accent bar");
  assert.equal(setBlockFormat(c, ["a"], "accentBar", { show: true, thickness: 99 }).ok, false);
  assert.deepEqual(sharedCapabilities(c.pages[0]!.blocks.filter((b) => b.id !== "d")).includes("accentBar"), true);
});

test("the filter choice and the page address agree both ways", () => {
  const f = { ...NO_FILTER, periodId: "p3", places: ["sindh", "punjab"], donors: ["ECHO"] };
  const back = fromSelection(decodeFilterSelection(encodeFilterSelection(toSelection(f))));
  assert.equal(back.periodId, "p3"); assert.deepEqual(back.places, ["punjab", "sindh"]); assert.deepEqual(back.donors, ["ECHO"]);
});

test("the starter sets add valid blocks", () => {
  for (const s of STARTER_SETS) for (const b of s.blocks) assert.ok(BLOCK_KINDS.includes(b.kind as never), `${s.id}: ${b.kind}`);
});

test("a figure card's items keep only their kind's settings; filter levels become numbers", () => {
  const props = { items: [{ source: { kind: "COUNT", metric: "DONORS", indicatorId: "x", measure: "PERIOD" } }, { source: { kind: "INDICATOR", indicatorId: "i" } }], layout: "GRID", columns: 3, includeDraft: false };
  const tidy = afterChange("MULTI_CARD", props, "items") as typeof props;
  assert.deepEqual(tidy.items[0]!.source, { kind: "COUNT", metric: "DONORS" });
  assert.deepEqual(tidy.items[1]!.source, { kind: "INDICATOR", indicatorId: "i", measure: "PERIOD" });
  const bar = afterChange("FILTER_BAR", { dimensions: ["PLACE"], controls: [{ dimension: "PLACE", levels: ["1", "2"] }] }, "controls") as { controls: Array<{ levels: number[] }> };
  assert.deepEqual(bar.controls[0]!.levels, [1, 2]);
  assert.ok(PROP_FIELDS.MULTI_CARD && PROP_FIELDS.MULTI_CARD.length > 0);
});

test("the accent bar and one-side border reach the screen as logical sides", () => {
  const css = frameCss({ title: { show: true, subtitle: null, sizePx: 14, bold: true, colour: "#000", align: "start", rule: false }, accentBar: { side: "start", px: 6, colour: "#d4a106" }, border: { side: "top", px: 2, colour: "#7a4f84" }, padding: null });
  assert.equal(css["borderInlineStart"], "6px solid #d4a106");
  assert.equal(css["borderTop"], "2px solid #7a4f84");
});

test("a map's first text card gets an id and the cards' lists and columns, so it is a valid setting at once", () => {
  const out = afterChange("MAP", { view: "RESULTS", callouts: { texts: [{ placeKey: "Humla", text: "Road cut" }] } }, "callouts.texts") as { callouts: { texts: Array<{ id: string }>; placeKeys: string[]; items: unknown[]; columns: number } };
  assert.ok(out.callouts.texts[0]!.id);
  assert.deepEqual([out.callouts.placeKeys, out.callouts.items, out.callouts.columns], [[], [], 3]);
});
