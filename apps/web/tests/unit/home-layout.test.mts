import test from "node:test";
import assert from "node:assert/strict";
import { HOME_TILES, HOME_TILES_BY_VARIANT } from "../../src/features/dashboard/domain/home-tiles.ts";
import {
  DEFAULT_ORDER, PANEL_INFO, checkHomeLayout, defaultLayout, movePanel, panelsFor, resolveLayout, sameLayout, setHidden, setSpan, toStoredLayout, type HomeLayout,
} from "../../src/features/dashboard/domain/home-layout.ts";

const VARIANTS = ["DIRECTOR", "MANAGER", "FIELD", "GRANTS", "COMPLIANCE"] as const;
const FIXED = ["NEEDS_YOU", "PINNED", "BOOKMARKS"];

test("every arranged panel is a known Home part, has widths and a place in the default order", () => {
  const arranged = HOME_TILES.filter((t) => !FIXED.includes(t));
  assert.deepEqual([...Object.keys(PANEL_INFO)].sort(), [...arranged].sort());
  assert.deepEqual([...DEFAULT_ORDER].sort(), [...arranged].sort());
  for (const [k, info] of Object.entries(PANEL_INFO)) assert.ok(info.spans.includes(info.defaultSpan), `${k} default width is not one it offers`);
});

test("the default layout shows exactly what the role shows, in order, none hidden", () => {
  for (const v of VARIANTS) {
    const layout = defaultLayout(v);
    assert.deepEqual(layout.map((p) => p.key).sort(), arrangedFor(v).sort());
    assert.ok(layout.every((p) => !p.hidden));
  }
  assert.deepEqual(panelsFor("DIRECTOR").includes("GRANTS"), true);
  assert.deepEqual(panelsFor("MANAGER").includes("GRANTS"), false);
});
const arrangedFor = (v: (typeof VARIANTS)[number]) => [...HOME_TILES_BY_VARIANT[v]].filter((t) => !FIXED.includes(t));

test("a stored layout can move and hide, but never reveal a panel the role does not show", () => {
  const stored = [{ key: "GRANTS", span: 6, hidden: false }, { key: "RISKS", span: 4, hidden: true }, { key: "NOTIFICATIONS", span: 12, hidden: false }];
  const manager = resolveLayout("MANAGER", stored);
  assert.ok(!manager.some((p) => p.key === "GRANTS"));
  assert.equal(manager[0]!.key, "RISKS");
  assert.equal(manager[0]!.hidden, true);
  assert.equal(manager[0]!.span, 4);
  assert.deepEqual(resolveLayout("DIRECTOR", stored)[0]!.key, "GRANTS");
});

test("panels the stored layout does not mention are added at the end, shown, at their default width", () => {
  const layout = resolveLayout("MANAGER", [{ key: "RISKS", span: 6, hidden: false }]);
  assert.equal(layout[0]!.key, "RISKS");
  assert.equal(layout.length, panelsFor("MANAGER").length);
  const added = layout.find((p) => p.key === "PROJECT_HEALTH")!;
  assert.deepEqual([added.span, added.hidden], [PANEL_INFO.PROJECT_HEALTH.defaultSpan, false]);
});

test("unreadable input falls back to the default and never throws", () => {
  for (const bad of [undefined, null, 5, "x", {}, [null, 3, "a", { key: 1 }, { key: "NOPE" }]]) assert.ok(sameLayout(resolveLayout("DIRECTOR", bad), defaultLayout("DIRECTOR")));
});

test("repeated entries are read once; a width the panel does not offer becomes its default", () => {
  const layout = resolveLayout("MANAGER", [{ key: "HEADLINES", span: 4, hidden: false }, { key: "HEADLINES", span: 12, hidden: true }]);
  assert.equal(layout.filter((p) => p.key === "HEADLINES").length, 1);
  const h = layout.find((p) => p.key === "HEADLINES")!;
  assert.deepEqual([h.span, h.hidden], [12, false]);
});

test("checkHomeLayout names every problem and accepts a good layout", () => {
  assert.deepEqual(checkHomeLayout("DIRECTOR", toStoredLayout(defaultLayout("DIRECTOR"))), []);
  assert.deepEqual(checkHomeLayout("MANAGER", "x"), ["The layout must be a list."]);
  const problems = checkHomeLayout("MANAGER", [{ key: "GRANTS", span: 6, hidden: false }, { key: "RISKS", span: 5, hidden: false }, { key: "RISKS", span: 6 }, { key: "X", span: 6, hidden: false }]);
  assert.equal(problems.length, 5);
});

test("moving swaps with the neighbour, stays put at the ends and for an unknown panel", () => {
  const base = defaultLayout("MANAGER");
  const second = base[1]!.key;
  const moved = movePanel(base, second, -1);
  assert.equal(moved[0]!.key, second);
  assert.equal(moved.length, base.length);
  assert.equal(movePanel(base, base[0]!.key, -1), base);
  assert.equal(movePanel(base, base[base.length - 1]!.key, 1), base);
  assert.equal(movePanel(base, "GRANTS", 1), base);
});

test("edits return new layouts and never change the one they were given", () => {
  const base: HomeLayout = defaultLayout("DIRECTOR");
  const copy = JSON.stringify(base);
  assert.equal(setSpan(base, "RISKS", 8)!.find((p) => p.key === "RISKS")!.span, 8);
  assert.equal(setSpan(base, "HEADLINES", 6), null);
  assert.equal(setSpan(base, "RISKS", 5 as never), null);
  assert.equal(setHidden(base, "MAP", true).find((p) => p.key === "MAP")!.hidden, true);
  assert.equal(JSON.stringify(base), copy);
});

test("what is stored is positions and flags only", () => {
  for (const p of toStoredLayout(defaultLayout("DIRECTOR"))) assert.deepEqual(Object.keys(p).sort(), ["hidden", "key", "span"]);
});

import { LAYOUT_COPY, PANEL_LABEL, SPAN_LABEL } from "../../src/features/dashboard/domain/home-layout-copy.ts";
import { PANEL_SPANS } from "../../src/features/dashboard/domain/home-layout.ts";

test("every arranged panel and width has a name a person can read", () => {
  assert.deepEqual(Object.keys(PANEL_LABEL).sort(), Object.keys(PANEL_INFO).sort());
  assert.deepEqual(Object.keys(SPAN_LABEL).map(Number).sort((a, b) => a - b), [...PANEL_SPANS]);
  for (const text of [...Object.values(PANEL_LABEL), ...Object.values(SPAN_LABEL), ...Object.values(LAYOUT_COPY)]) {
    assert.ok(text.trim().length > 0);
    assert.ok(!/[A-Z]+_[A-Z_]+|[a-z]+_[a-z_]+|\b[0-9a-f]{8}-[0-9a-f]{4}\b/.test(text), `"${text}" shows a code`);
  }
});
