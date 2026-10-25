import { test } from "node:test";
import assert from "node:assert/strict";
import { findRawTokens } from "@donordesk/domain/core/copy-lint.js";
import { INFOGRAPHIC_SECTION_KINDS, INFOGRAPHIC_TEMPLATES, INFOGRAPHIC_THEMES, validateConfig, knownTemplates, configFromTemplate, INFOGRAPHIC_FORMATS, INFOGRAPHIC_ICONS } from "@donordesk/domain/contexts/infographics/index.js";
import { BLOCK_CATALOG, BLOCK_GROUPS, BLOCK_ORDER, SPAN_LABEL, blocksForScope, duplicateSection, newSection, spanChoices } from "../../src/features/infographics/domain/block-catalog.ts";
import * as copy from "../../src/features/infographics/domain/studio-copy.ts";
import { canRedo, canUndo, createHistory, isDirty, pushState, redo, undo } from "../../src/features/infographics/domain/studio-history.ts";
import { buildMapShapes, outerRingsOf, shapePointCount, simplifyRing, type Ring } from "../../src/features/infographics/domain/geo-shapes.ts";
import type { NamedGeoCollection } from "../../src/features/workplan/domain/geo/geo-types.ts";

test("the catalog covers every section kind, in a known group, with words that are not codes", () => {
  assert.deepEqual([...BLOCK_ORDER].sort(), [...INFOGRAPHIC_SECTION_KINDS].sort());
  const groups = new Set(BLOCK_GROUPS.map((g) => g.id));
  for (const kind of INFOGRAPHIC_SECTION_KINDS) {
    const info = BLOCK_CATALOG[kind];
    assert.ok(groups.has(info.group), kind);
    assert.deepEqual(findRawTokens(info.label), [], `${kind} label`);
    assert.deepEqual(findRawTokens(info.description), [], `${kind} description`);
    assert.ok(info.description.endsWith("."), `${kind} reads as a sentence`);
  }
  for (const g of BLOCK_GROUPS) assert.deepEqual(findRawTokens(g.label), []);
});

test("every block starts as a valid section, and a template that holds one still validates", () => {
  for (const kind of INFOGRAPHIC_SECTION_KINDS) {
    const section = newSection(kind);
    assert.equal(section.kind, kind);
    const portfolio = kind.startsWith("PORTFOLIO_");
    const result = validateConfig({ ...configFromTemplate(portfolio ? "PORTFOLIO_OVERVIEW" : "CUSTOM")!, sections: [section] }, knownTemplates());
    assert.equal(result.ok, true, `${kind}: ${result.ok ? "" : result.error.message}`);
  }
  assert.notEqual(newSection("KEY_MESSAGES"), newSection("KEY_MESSAGES"), "each call gives an independent object");
});

test("width choices run from the block's narrowest width up to the full page", () => {
  assert.deepEqual(spanChoices("HERO"), [12]);
  assert.deepEqual(spanChoices("TEXT"), [3, 4, 6, 8, 9, 12]);
  assert.deepEqual(spanChoices("TABLE"), [8, 9, 12]);
  for (const kind of INFOGRAPHIC_SECTION_KINDS) {
    for (const span of spanChoices(kind)) assert.ok(SPAN_LABEL[span], `${kind} ${span}`);
    assert.ok(spanChoices(kind).includes(12), kind);
    assert.ok(spanChoices(kind).includes(newSection(kind).span ?? 12), `${kind}'s own default width is one of its choices`);
  }
});

test("duplicating a section copies it deeply and marks the title", () => {
  const original = { kind: "KEY_MESSAGES" as const, title: "What we did", messages: [{ text: "a" }] };
  const copyOf = duplicateSection(original);
  assert.equal(copyOf.title, "What we did (copy)");
  copyOf.messages![0]!.text = "changed";
  assert.equal(original.messages[0]!.text, "a");
  assert.equal(duplicateSection({ kind: "TEXT" }).title, undefined);
});

test("every template's sections use blocks the catalog knows, at widths the block allows", () => {
  for (const t of Object.values(INFOGRAPHIC_TEMPLATES)) {
    for (const s of t.sections) {
      assert.ok(BLOCK_CATALOG[s.kind], `${t.id} ${s.kind}`);
      const span = s.span ?? (s.size === "HALF" ? 6 : s.size === "THIRD" ? 4 : 12);
      if (t.family !== "OVERVIEW" || t.id.length > 0) assert.ok(span >= 3 && span <= 12);
    }
  }
});

test("Studio copy tables hold no raw codes", () => {
  for (const [name, value] of Object.entries(copy)) {
    const rows = Array.isArray(value) ? value : Object.values(value as Record<string, unknown>);
    for (const row of rows) {
      const strings = typeof row === "string" ? [row] : Object.values(row as Record<string, unknown>).filter((x): x is string => typeof x === "string" && !/^(?:[A-Z][A-Z_0-9]+)$/.test(x));
      for (const text of strings) assert.deepEqual(findRawTokens(text), [], `${name}: “${text}”`);
    }
  }
  for (const t of Object.values(INFOGRAPHIC_THEMES)) for (const text of [t.label, t.description]) assert.deepEqual(findRawTokens(text), [], t.id);
  for (const f of Object.values(INFOGRAPHIC_FORMATS)) for (const text of [f.label, f.description]) assert.deepEqual(findRawTokens(text), [], f.id);
  for (const i of INFOGRAPHIC_ICONS) assert.deepEqual(findRawTokens(i.label), [], i.id);
});

test("history: undo and redo walk the edits; a new edit drops the redo branch; the same field merges while typing", () => {
  let h = createHistory("a");
  h = pushState(h, "b", 0);
  h = pushState(h, "c", 5000);
  assert.deepEqual([h.present, canUndo(h), canRedo(h)], ["c", true, false]);
  h = undo(h);
  assert.equal(h.present, "b");
  h = undo(h);
  assert.equal(h.present, "a");
  assert.equal(canUndo(h), false);
  assert.equal(undo(h), h, "nothing to undo changes nothing");
  h = redo(h);
  assert.equal(h.present, "b");
  h = pushState(h, "z", 20000);
  assert.equal(canRedo(h), false);
  assert.deepEqual(h.past, ["a", "b"]);
  const same = pushState(h, h.present, 30000);
  assert.equal(same, h, "an unchanged value is not a step");

  let typing = createHistory("");
  for (const [i, v] of ["h", "he", "hel", "hell", "hello"].entries()) typing = pushState(typing, v, 100 * i, "title");
  assert.equal(typing.past.length, 1, "five keystrokes in one field are one undo step");
  assert.equal(undo(typing).present, "");
  typing = pushState(typing, "hello!", 100 * 5 + 5000, "title");
  assert.equal(typing.past.length, 2, "a pause starts a new step");
  typing = pushState(typing, "hello!!", 5000 + 500 + 100, "subtitle");
  assert.equal(typing.past.length, 3, "another field is another step");
});

test("history: it keeps at most a hundred steps, and the saved state is recognised again after undoing", () => {
  let h = createHistory(0);
  for (let i = 1; i <= 150; i += 1) h = pushState(h, i, i * 10_000);
  assert.equal(h.past.length, 100);
  const saved = h.present;
  const edited = pushState(h, saved + 1, 2_000_000);
  assert.equal(isDirty(edited, saved), true);
  assert.equal(isDirty(undo(edited), saved), false);
});

const square = (x: number, y: number, s: number): Ring => [[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]];

test("outlines: outer rings of polygons and multipolygons; holes and junk are ignored", () => {
  const poly = { type: "Polygon", coordinates: [square(0, 0, 4), square(1, 1, 1)] };
  assert.equal(outerRingsOf(poly).length, 1);
  const multi = { type: "MultiPolygon", coordinates: [[square(0, 0, 4)], [square(10, 10, 2)]] };
  assert.equal(outerRingsOf(multi).length, 2);
  assert.deepEqual(outerRingsOf(null), []);
  assert.deepEqual(outerRingsOf({ type: "Point", coordinates: [1, 2] }), []);
  assert.deepEqual(outerRingsOf({ type: "Polygon", coordinates: [[[1, 2], [3, 4]]] }), [], "fewer than three points is not a ring");
});

test("outlines: simplifying keeps the shape's extremes and never exceeds the limit", () => {
  const circle: Ring = Array.from({ length: 1200 }, (_, i) => [Math.cos((i / 1200) * Math.PI * 2) * 10, Math.sin((i / 1200) * Math.PI * 2) * 10]);
  const out = simplifyRing(circle, 60);
  assert.equal(out.length, 60);
  const xs = out.map((p) => p[0]);
  assert.ok(Math.max(...xs) > 9.8 && Math.min(...xs) < -9.8, "still a circle of radius ~10");
  assert.equal(simplifyRing(square(0, 0, 1), 10).length, 4, "a small ring is only unclosed");
  assert.equal(simplifyRing(Array.from({ length: 5000 }, (_, i) => [i, Math.sin(i / 50)] as [number, number]), 100).length, 100);
});

const world: NamedGeoCollection = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", properties: { name: "Uganda", iso: "UG" }, geometry: { type: "MultiPolygon", coordinates: [[square(30, 0, 5)], [square(50, 50, 0.1)]] } },
    { type: "Feature", properties: { name: "Kenya", iso: "KE" }, geometry: { type: "Polygon", coordinates: [square(36, 0, 5)] } },
  ],
};
const admin1: NamedGeoCollection = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", properties: { name: "Gulu", country: "Uganda" }, geometry: { type: "Polygon", coordinates: [square(31, 1, 1)] } },
    { type: "Feature", properties: { name: "Kitgum", country: "Uganda" }, geometry: { type: "Polygon", coordinates: [square(32, 1, 1)] } },
    { type: "Feature", properties: { name: "Nairobi", country: "Kenya" }, geometry: { type: "Polygon", coordinates: [square(37, 1, 1)] } },
  ],
};

test("map shapes: the country, then only its own areas, shaded only where a figure exists", () => {
  const shapes = buildMapShapes({ country: " uganda ", world, admin1, withRegions: true, valueByLocation: { gulu: 120 } });
  assert.deepEqual(shapes.map((s) => [s.kind, s.name]), [["COUNTRY", "Uganda"], ["REGION", "Gulu"], ["REGION", "Kitgum"]]);
  assert.equal(shapes[0]!.rings.length, 1, "a tiny island far away is left out");
  assert.equal(shapes[1]!.value, 120);
  assert.equal("value" in shapes[2]!, false, "no figure: unshaded, never zero");
  assert.deepEqual(buildMapShapes({ country: "Uganda", world, admin1, withRegions: false }).map((s) => s.kind), ["COUNTRY"]);
  assert.deepEqual(buildMapShapes({ country: "Atlantis", world, admin1, withRegions: true }), []);
  assert.deepEqual(buildMapShapes({ country: "", world, withRegions: true }), []);
  assert.ok(shapePointCount(shapes) < 60_000, "within the request limit");
});

test("a portfolio page offers only portfolio-safe blocks; a project page offers none of the portfolio ones; every block is offered somewhere", () => {
  const portfolio = new Set(blocksForScope("PORTFOLIO"));
  const project = new Set(blocksForScope("PROJECT"));
  for (const kind of ["PORTFOLIO_SUMMARY", "PORTFOLIO_TABLE", "PORTFOLIO_HEALTH", "PORTFOLIO_COUNTRIES", "MAP", "HERO", "TEXT", "BIG_NUMBERS"] as const) assert.ok(portfolio.has(kind), `${kind} on a portfolio page`);
  for (const kind of ["FUNDING", "PROGRESS_RINGS", "TABLE", "DEMOGRAPHICS", "THREE_W"] as const) assert.equal(portfolio.has(kind), false, `${kind} not on a portfolio page`);
  for (const kind of project) assert.equal(kind.startsWith("PORTFOLIO_"), false);
  for (const kind of BLOCK_ORDER) assert.ok(portfolio.has(kind) || project.has(kind), kind);
  // Whatever a portfolio page offers, it accepts when saved.
  for (const kind of portfolio) {
    const result = validateConfig({ ...configFromTemplate("PORTFOLIO_OVERVIEW")!, sections: [newSection(kind)] }, knownTemplates());
    assert.equal(result.ok, true, `${kind}: ${result.ok ? "" : result.error.message}`);
  }
});
