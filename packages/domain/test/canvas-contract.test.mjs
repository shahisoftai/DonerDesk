import test from "node:test";
import assert from "node:assert/strict";
import { BLOCK_KINDS, PENDING_KINDS, BLOCK_FIXTURES, SAMPLE_SHEET, BLOCK_FAMILIES, RENDER_SURFACES, definitionFor, checkCanvas, canPublish, modelProblems, functionPaths, modelFingerprint, canvasAiEnabledFor, aiGate } from "../dist/index.js";

const KINDS = [...BLOCK_KINDS];
const STATES = ["ready", "empty", "unavailable"];
const SEVERITIES = ["BLOCKER", "WARN", "TIP"];
const instance = (id, kind, props, over = {}) => ({ id, kind, bounds: { x: 0, y: 0, w: 6, h: 2 }, props, bindings: [], ...over });
const canvasOf = (blocks, profile = "DONOR_REPORT") => ({ id: "c", scope: "PROJECT", mode: "LIVE", profile, title: "T", language: "en", themeId: "DEFAULT", revision: 1, pages: [{ id: "p", title: "P", format: "WEB_FLUID", blocks }] });

// ---- completeness: a block ships whole or it does not ship ----

test("every catalogue kind has a definition and a fixture, and nothing else has a fixture", () => {
  assert.deepEqual(PENDING_KINDS, [], "no block is left unported");
  assert.deepEqual(Object.keys(BLOCK_FIXTURES).sort(), [...KINDS].sort());
  for (const k of KINDS) assert.ok(definitionFor(k), k);
});

test("a definition is complete: family, label key, validate, defaults, slots, sizes, lint table, resolve", () => {
  for (const kind of KINDS) {
    const def = definitionFor(kind);
    assert.ok(BLOCK_FAMILIES.includes(def.family), `${kind} family`);
    assert.equal(def.labelKey, `canvas.block.${kind}`);
    for (const fn of ["defaults", "validate", "resolve"]) assert.equal(typeof def[fn], "function", `${kind}.${fn}`);
    assert.ok(Array.isArray(def.slots) && Array.isArray(def.lint), `${kind} slots and lint tables exist`);
    const ids = def.lint.map((r) => r.id);
    assert.equal(new Set(ids).size, ids.length, `${kind} lint ids are unique`);
    for (const r of def.lint) { assert.ok(SEVERITIES.includes(r.severity)); assert.equal(typeof r.check, "function"); }
    assert.deepEqual(def.validate(BLOCK_FIXTURES[kind].props), [], `${kind} fixture is valid`);
  }
});

test("no lint rule is a stub: every rule a block owns can fail", () => {
  // A rule that can never return a message is a rule that was meant to exist; it must be written or removed.
  for (const kind of KINDS) for (const r of definitionFor(kind).lint) {
    const probes = [BLOCK_FIXTURES[kind].props, {}, { text: "", title: "" }];
    assert.ok(probes.some((p) => { try { return r.check(p) !== null; } catch { return true; } }), `${kind}.${r.id} never fails`);
  }
});

// ---- lint traits: the registry says which blocks need a description, rules never name kinds ----

test("blocks that are pictures declare it, and a public profile asks for a description of each", () => {
  const pictures = KINDS.filter((k) => definitionFor(k).needsAlt);
  assert.deepEqual(pictures.sort(), ["CHART", "IMAGE", "MAP", "SMALL_MULTIPLES"]);
  for (const kind of pictures) {
    const props = { ...BLOCK_FIXTURES[kind].props };
    delete props.altText;
    const bare = checkCanvas(canvasOf([instance("b", kind, props)]));
    assert.ok(bare.some((f) => f.ruleId === "ALT_MISSING" && f.blockId === "b"), `${kind} without a description is a blocker`);
    assert.equal(canPublish(bare), false);
    const described = checkCanvas(canvasOf([instance("b", kind, props, { alt: "A description." })]));
    assert.ok(!described.some((f) => f.ruleId === "ALT_MISSING"), `${kind} with one is fine`);
  }
  const text = checkCanvas(canvasOf([instance("t", "TEXT", BLOCK_FIXTURES.TEXT.props)]));
  assert.ok(!text.some((f) => f.ruleId === "ALT_MISSING"));
});

test("a snapshot counts headline blocks through the trait", () => {
  assert.deepEqual(KINDS.filter((k) => definitionFor(k).headline).sort(), ["BANNER", "HERO"]);
  const many = [1, 2, 3, 4].map((i) => instance(`h${i}`, i % 2 ? "HERO" : "BANNER", BLOCK_FIXTURES.HERO.props));
  assert.ok(checkCanvas(canvasOf(many, "SNAPSHOT")).some((f) => f.ruleId === "TOO_MANY_THEMES"));
  assert.ok(!checkCanvas(canvasOf(many.slice(0, 3), "SNAPSHOT")).some((f) => f.ruleId === "TOO_MANY_THEMES"));
});

// ---- resolve: the model is what both screen and print paint, so it must be the same every time and survive being stored ----

test("resolve is pure and its model is plain data, for every block", () => {
  for (const kind of KINDS) {
    const def = definitionFor(kind); const { props, data } = BLOCK_FIXTURES[kind];
    const a = def.resolve(props, data); const b = def.resolve(structuredClone(props), data === undefined ? undefined : structuredClone(data));
    assert.equal(modelFingerprint(a), modelFingerprint(b), `${kind} gives the same model twice`);
    assert.ok(STATES.includes(a.state), kind);
    if (a.state === "ready") {
      assert.deepEqual(modelProblems(a.model), [], `${kind} model is plain data`);
      assert.ok(functionPaths(a.model).every((p) => p.endsWith(".formatter")), `${kind} model holds no function but chart formatters`);
      if (functionPaths(a.model).length === 0) assert.equal(modelFingerprint(JSON.parse(JSON.stringify(a.model))), modelFingerprint(a.model), `${kind} model survives being written down`);
      assert.ok(Array.isArray(a.notes));
    } else assert.ok(a.reason.trim().length > 5, `${kind} says why in a sentence`);
  }
});

test("a block with nothing to show says so; it never invents a figure", () => {
  for (const kind of KINDS) {
    const def = definitionFor(kind);
    if (def.requiresSetup) continue;
    const r = def.resolve(def.defaults(), undefined);
    assert.ok(STATES.includes(r.state));
    if (r.state === "ready") assert.ok(!/\b0\b/.test(JSON.stringify(r.model).replace(/"(?:w|h|x|y)":\d+/g, "")) || kind === "DIVIDER", `${kind} shows no bare 0 by default`);
  }
});

// ---- honesty: the rules every data-bound block must keep ----

test("a month nobody recorded is a gap in a chart, a table and a sparkline - never 0", () => {
  const chart = definitionFor("CHART").resolve(BLOCK_FIXTURES.CHART.props, BLOCK_FIXTURES.CHART.data);
  assert.deepEqual(chart.model.option.series[0].data, [10, null, 30]);
  const table = definitionFor("TABLE").resolve(BLOCK_FIXTURES.TABLE.props, BLOCK_FIXTURES.TABLE.data);
  assert.deepEqual(table.model.rows.map((r) => r.cells[0]), ["10", null, "30"]);
  const kpi = definitionFor("KPI").resolve(BLOCK_FIXTURES.KPI.props, BLOCK_FIXTURES.KPI.data);
  assert.deepEqual(kpi.model.spark.map((s) => s.value), [10, null, 30]);
  assert.equal(kpi.model.change.sincePeriod, "Jan 2026", "the change skips the empty month");
});

test("a rate has no percent of target and is never judged as progress", () => {
  const kpi = definitionFor("KPI").resolve({ indicatorId: "r", includeDraft: false }, { sheet: SAMPLE_SHEET });
  assert.equal(kpi.model.percentOfTarget, null);
  assert.equal(kpi.model.status, "NOT_JUDGED");
});

test("a tile with no data says it has none instead of showing 0", () => {
  const m = definitionFor("METRIC").resolve({ metric: "ACTIVITIES_TOTAL" }, undefined);
  assert.equal(m.model.value, null);
  assert.equal(m.model.text, "");
  assert.ok(m.model.note);
});

test("an indicator that is gone is unavailable with a reason, not an empty tile", () => {
  const r = definitionFor("KPI").resolve({ indicatorId: "zz", includeDraft: false }, { sheet: SAMPLE_SHEET });
  assert.equal(r.state, "unavailable");
});

test("an AI block shows nothing until text exists and says plainly when it is not accepted", () => {
  const ai = definitionFor("AI_SUMMARY");
  assert.equal(ai.resolve({}, undefined).state, "empty");
  assert.deepEqual(ai.resolve({}, { text: "  " }).state, "empty");
  assert.deepEqual(ai.resolve({}, { text: "Two boreholes opened.", accepted: false }).notes, ["AI-drafted. Not accepted yet."]);
  assert.deepEqual(ai.resolve({}, { text: "Two boreholes opened.", accepted: true }).notes, []);
});

// ---- model safety helper ----

test("modelProblems names what cannot be stored or shared", () => {
  assert.deepEqual(modelProblems({ a: [1, null, "x"], b: { c: true } }), []);
  const bad = modelProblems({ n: NaN, i: Infinity, f: () => 1, d: new Date(), arr: [1, undefined] });
  assert.equal(bad.length, 5);
  assert.deepEqual(modelProblems({ axis: { formatter: (n) => String(n) } }), [], "a chart formatter is allowed");
  const loop = {}; loop.self = loop;
  assert.match(modelProblems(loop)[0], /itself/);
  assert.deepEqual(functionPaths({ a: { formatter: () => 1 }, b: [1] }), ["model.a.formatter"]);
  assert.equal(modelFingerprint({ b: 1, a: { formatter: (n) => n } }), modelFingerprint({ a: { formatter: (n) => n }, b: 1 }), "key order and function identity do not matter");
  assert.notEqual(modelFingerprint({ a: 1 }), modelFingerprint({ a: 2 }));
});

// ---- the renderer contract and the AI switch ----

test("there are two paint surfaces, and AI needs both the platform flag and the canvas flag", () => {
  assert.deepEqual([...RENDER_SURFACES], ["SCREEN", "PRINT"]);
  assert.equal(canvasAiEnabledFor({ aiEnabled: true, canvasAiEnabled: false }), false, "platform AI alone does not switch the canvas on");
  assert.equal(canvasAiEnabledFor({ aiEnabled: false, canvasAiEnabled: true }), false);
  assert.equal(canvasAiEnabledFor({ aiEnabled: true, canvasAiEnabled: true }), true);
  assert.deepEqual(aiGate({ organisationEnabled: false, providerConfigured: true, external: false, overCap: false }), { allowed: false, reason: "OFF" });
});
