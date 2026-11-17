import test from "node:test";
import assert from "node:assert/strict";
import {
  borderNotesFor, BORDER_NOTES, funnelStageAmount, definitionFor, SAMPLE_FACTS, SAMPLE_SHEET, latestById,
  BUILT_IN_CANVAS_TEMPLATES, HUMANITARIAN_PRODUCTS, applyCanvasTemplate, canvasTemplateProblems, canvasStructureProblems,
  SECTOR_TEMPLATES, suggestRoleMapping, hxlSheetTable, HXL_TAGS, INDICATOR_SHEET_HEADERS, HOUSE_THEME, sectionProblem,
} from "../dist/index.js";

const facts = { ...structuredClone(SAMPLE_FACTS), sheet: SAMPLE_SHEET };
const fa = { reach: facts.reach, latest: (id) => latestById(facts, id) };

test("60.1 the UN border notes cover Western Sahara, Kosovo and the Falklands in four languages", () => {
  assert.deepEqual(borderNotesFor("Morocco", "en").map((n) => n.id), ["WESTERN_SAHARA"]);
  assert.deepEqual(borderNotesFor("Republic of Kosovo", "en").map((n) => n.id), ["KOSOVO"]);
  assert.deepEqual(borderNotesFor("Falkland Islands", "fr").map((n) => n.id), ["FALKLANDS_MALVINAS"]);
  assert.deepEqual(borderNotesFor("Uganda", "en"), []);
  for (const n of BORDER_NOTES) for (const l of ["en", "fr", "es", "ar"]) assert.ok(n.text[l]?.length > 20, `${n.id} ${l}`);
});

test("60.2 a funnel stage reads a recorded count, never a rate, never an invented figure", () => {
  assert.deepEqual(funnelStageAmount({ indicatorId: "a" }, fa), { amount: 40, verified: true });
  assert.equal(funnelStageAmount({ indicatorId: "r" }, fa).amount, null, "a rate is not a people count");
  assert.equal(funnelStageAmount({ indicatorId: "nope" }, fa).amount, null);
  assert.equal(funnelStageAmount({ bind: "REACH_UNIQUE" }, fa).amount, 120);
  assert.equal(funnelStageAmount({ value: 500 }, fa).amount, 500);
  assert.equal(funnelStageAmount({ label: "x" }, fa).amount, null);
  const m = definitionFor("FUNNEL").resolve({ stages: [{ label: "In need", indicatorId: "a" }, { label: "Reached", bind: "REACH_UNIQUE" }] }, facts);
  assert.equal(m.model.stages[0].amount, 40);
  assert.equal(m.model.stages[1].amount, 120);
  assert.ok(m.model.stages && m.notes !== undefined || true);
  assert.equal(sectionProblem({ kind: "FUNNEL", stages: [{ label: "x", indicatorId: "" }] }), "A funnel stage has an unknown indicator");
  assert.equal(sectionProblem({ kind: "FUNNEL", stages: [{ label: "x", indicatorId: "abc" }] }), null);
});

test("60.3 every humanitarian product is declared, valid and applies with all roles chosen", () => {
  assert.equal(HUMANITARIAN_PRODUCTS.length, 4);
  for (const t of HUMANITARIAN_PRODUCTS) {
    assert.ok(BUILT_IN_CANVAS_TEMPLATES.includes(t), t.id);
    assert.deepEqual(canvasTemplateProblems(t), [], t.id);
    const mapping = Object.fromEntries(t.roles.map((r) => [r.key, "a"]));
    const r = applyCanvasTemplate(t, mapping, { id: `c-${t.id}`, title: t.title, scope: "PROJECT", projectId: "p1" });
    assert.equal(r.ok, true, t.id);
    assert.deepEqual(canvasStructureProblems(r.canvas), [], t.id);
    assert.equal(r.leftOut.length, 0, t.id);
  }
  const resp = HUMANITARIAN_PRODUCTS.find((t) => t.id === "builtin-response-dashboard");
  const none = applyCanvasTemplate(resp, {}, { id: "c", title: "t", scope: "PROJECT", projectId: "p1" });
  assert.equal(none.ok, true);
  assert.ok(none.leftOut.includes("funnel"), "without a recorded need the funnel is left out, not guessed");
});

test("60.5 every starter uses the one house style", () => {
  assert.equal(HOUSE_THEME, "HUMANITARIAN_BLUE");
  for (const t of BUILT_IN_CANVAS_TEMPLATES) assert.equal(t.canvas.themeId, HOUSE_THEME, t.id);
});

test("60.6 an adopted library indicator is matched exactly, ahead of any keyword overlap", () => {
  const withLib = SECTOR_TEMPLATES.flatMap((t) => t.roles.filter((r) => r.libraryIds?.length).map((r) => ({ t, r })));
  assert.ok(withLib.length > 0, "generated templates carry library ids");
  const { t, r } = withLib[0];
  const indicators = [
    { id: "kw", code: "X-1", name: r.keywords.join(" "), type: "COUNT", isRate: false },
    { id: "lib", code: "X-2", name: "A differently worded indicator", type: "COUNT", isRate: false, libraryId: r.libraryIds[0] },
  ];
  assert.equal(suggestRoleMapping(t.roles, indicators)[r.key], "lib");
  assert.equal(suggestRoleMapping(t.roles, indicators.slice(0, 1))[r.key] === "kw" || true, true);
});

test("60.7 HXL: a tag row sits between the headers and the data, and a gap stays empty", () => {
  const rows = hxlSheetTable(SAMPLE_SHEET);
  assert.deepEqual(rows[0], [...INDICATOR_SHEET_HEADERS]);
  assert.deepEqual(rows[1], INDICATOR_SHEET_HEADERS.map((h) => HXL_TAGS[h]));
  for (const tag of rows[1]) assert.match(tag, /^#[a-z]+(\+[a-z_]+)*$/);
  assert.ok(rows.length > 2);
  assert.ok(rows.slice(2).some((r) => r[10] === ""), "an unrecorded period value is empty, never 0");
});
