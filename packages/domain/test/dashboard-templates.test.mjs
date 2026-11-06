import assert from "node:assert/strict";
import test from "node:test";
import {
  SECTOR_TEMPLATES, TEMPLATE_SECTORS, TEMPLATE_SECTOR_ORDER, templatesForSector, templateProblems, applyTemplate, suggestRoleMapping, copyTemplate,
  addTemplateRole, updateTemplateRole, removeTemplateRole, addTemplateWidget, updateTemplateWidget, moveTemplateWidget, resizeTemplateWidget, removeTemplateWidget,
  updateTemplateDetails, buildDataChart, toLegacySpec, GRID_COLUMNS,
} from "../dist/index.js";

const wash = SECTOR_TEMPLATES.find((t) => t.id === "tpl-wash-access-hygiene");
const ok = (r) => { assert.equal(r.ok, true, r.reason); return r.template; };

test("every starter template is valid, a draft, and uses only roles it declares", () => {
  assert.ok(SECTOR_TEMPLATES.length >= 6);
  const ids = new Set();
  for (const t of SECTOR_TEMPLATES) {
    assert.deepEqual(templateProblems(t), [], t.id);
    assert.equal(t.status, "DRAFT");
    assert.equal(t.origin, "BUILT_IN");
    assert.ok(TEMPLATE_SECTORS[t.sector], t.id);
    assert.ok(!ids.has(t.id)); ids.add(t.id);
    for (const w of t.widgets) assert.ok(w.x + w.w <= GRID_COLUMNS);
  }
  assert.equal(TEMPLATE_SECTOR_ORDER.length, 12);
  assert.ok(templatesForSector("WASH").length >= 1);
  assert.deepEqual(templatesForSector("CLIMATE"), []);
});

const projectIndicators = [
  { id: "i1", code: "WASH-1", name: "People with basic drinking water access", type: "COUNT", isRate: false },
  { id: "i2", code: "WASH-2", name: "People using basic sanitation (latrines)", type: "COUNT", isRate: false },
  { id: "i3", code: "WASH-3", name: "Handwashing stations built", type: "COUNT", isRate: false },
  { id: "i4", code: "WASH-4", name: "People reached by hygiene promotion sessions", type: "COUNT", isRate: false },
  { id: "i5", code: "WASH-5", name: "% of water points functional", type: "PERCENTAGE", isRate: true },
  { id: "i6", code: "ADM-1", name: "Staff retained", type: "COUNT", isRate: false },
];

test("roles are suggested from the words an indicator shares, never matched to the wrong kind, never reused, never guessed", () => {
  const m = suggestRoleMapping(wash.roles, projectIndicators);
  assert.equal(m.people_basic_water, "i1");
  assert.equal(m.people_basic_sanitation, "i2");
  assert.equal(m.handwashing_facilities, "i3");
  assert.equal(m.hygiene_promotion_reach, "i4");
  assert.equal(m.water_points_functional, "i5");
  assert.ok(!Object.values(m).includes("i6"));
  // the rate is not offered to a count role even though it shares "water"
  const onlyRate = suggestRoleMapping(wash.roles, [projectIndicators[4]]);
  assert.equal(onlyRate.people_basic_water, null);
  assert.equal(onlyRate.water_points_functional, "i5");
  // nothing similar: nothing suggested
  assert.ok(Object.values(suggestRoleMapping(wash.roles, [projectIndicators[5]])).every((v) => v === null));
  // one indicator answers at most one role
  const dup = suggestRoleMapping(wash.roles, [projectIndicators[0]]);
  assert.equal(Object.values(dup).filter((v) => v === "i1").length, 1);
});

test("a template works with no, some or all roles chosen: it says what is missing and never invents a figure", () => {
  const none = applyTemplate(wash, {});
  assert.deepEqual(none.unmappedRequired.sort(), ["handwashing_facilities", "hygiene_promotion_reach", "people_basic_sanitation", "people_basic_water"]);
  const states = Object.fromEntries(none.widgets.map((w) => [w.widget.id, w.state]));
  assert.equal(states.progress, "NEEDS_INDICATOR");
  assert.equal(states["trend-1"], "NEEDS_INDICATOR");
  assert.equal(states["data-status"], "READY");
  assert.ok(none.widgets.find((w) => w.widget.id === "trend-1").missingRoles.includes("people_basic_water"));

  const some = applyTemplate(wash, { people_basic_water: "i1" });
  const progress = some.widgets.find((w) => w.widget.id === "progress");
  assert.equal(progress.state, "READY");
  assert.deepEqual(progress.spec.dataset.indicatorIds, ["i1"]);
  assert.equal(some.widgets.find((w) => w.widget.id === "trend-2").state, "NEEDS_INDICATOR");

  const all = applyTemplate(wash, suggestRoleMapping(wash.roles, projectIndicators));
  assert.deepEqual(all.unmappedRequired, []);
  assert.ok(all.widgets.every((w) => w.state === "READY"));
});

test("every ready chart of every starter template is drawn by the real chart builder (a gap, never a failure)", () => {
  const periods = [1, 2, 3].map((n) => ({ id: `p${n}`, label: `M${n}`, start: `2026-0${n}-01`, end: `2026-0${n}-28`, reportType: "MONTHLY", locked: false }));
  for (const t of SECTOR_TEMPLATES) {
    const inds = t.roles.map((r, i) => ({ id: `r${i}`, code: r.key, name: r.label, level: "OUTPUT", type: "COUNT", unit: "people", baseline: "0", target: "100", isRate: false }));
    const mapping = Object.fromEntries(t.roles.map((r, i) => [r.key, `r${i}`]));
    const sheet = { projectId: "x", periods, indicators: inds, cells: inds.flatMap((i) => periods.map((p, n) => ({ indicatorId: i.id, periodId: p.id, periodValue: String(10 * (n + 1)), cumulativeValue: String(10 * (n + 1) * (n + 2) / 2), status: "VERIFIED" }))), finance: [] };
    for (const w of applyTemplate(t, mapping).widgets) {
      assert.equal(w.state, "READY", `${t.id}/${w.widget.id}`);
      const legacy = toLegacySpec(w.spec);
      assert.ok(legacy, `${t.id}/${w.widget.id} is drawn today`);
      const r = buildDataChart(sheet, legacy);
      assert.equal(r.ok, true, `${t.id}/${w.widget.id}: ${r.reason}`);
    }
  }
});

test("a built-in template is never changed in place: a copy is the organisation's own draft", () => {
  const before = JSON.stringify(wash);
  const mine = copyTemplate(wash, { id: "org-1" });
  assert.equal(mine.origin, "ORGANISATION");
  assert.equal(mine.basedOn, wash.id);
  assert.equal(mine.status, "DRAFT");
  assert.equal(mine.revision, 1);
  assert.equal(mine.title, `${wash.title} (copy)`);
  const edited = ok(updateTemplateDetails(mine, { title: "Our WASH view" }));
  assert.equal(edited.title, "Our WASH view");
  assert.equal(edited.revision, 2);
  assert.equal(mine.title, `${wash.title} (copy)`);
  assert.equal(JSON.stringify(wash), before);
  assert.deepEqual(templateProblems(copyTemplate(wash, { id: "x" })), []);
});

test("roles can be added and changed; removing one that charts use is refused by name", () => {
  let t = copyTemplate(wash, { id: "o" });
  t = ok(addTemplateRole(t, { key: "latrines_built", label: "Latrines built", hint: "h", keywords: ["latrine"], types: ["COUNT"], required: false }));
  assert.equal(addTemplateRole(t, t.roles[0]).ok, false);
  assert.equal(addTemplateRole(t, { key: "Bad Key", label: "x", hint: "", keywords: [], types: ["ANY"], required: false }).ok, false);
  t = ok(updateTemplateRole(t, "latrines_built", { label: "Latrines completed", required: true }));
  assert.equal(t.roles.find((r) => r.key === "latrines_built").label, "Latrines completed");
  assert.equal(updateTemplateRole(t, "nope", {}).ok, false);
  const refused = removeTemplateRole(t, "people_basic_water");
  assert.equal(refused.ok, false);
  assert.match(refused.reason, /Charts still use this role/);
  t = ok(removeTemplateRole(t, "latrines_built"));
  assert.ok(!t.roles.some((r) => r.key === "latrines_built"));
});

test("charts can be added, retitled, rewired, moved, resized and removed, and the layout never overlaps", () => {
  let t = copyTemplate(wash, { id: "o" });
  const n = t.widgets.length;
  t = ok(addTemplateWidget(t, { id: "extra", kind: "CHART", title: "Hygiene reach as bars", chart: { kind: "BAR", template: "INDICATOR_OVER_TIME", roleKeys: ["hygiene_promotion_reach"], measure: "PERIOD", showTarget: false } }));
  assert.equal(t.widgets.length, n + 1);
  assert.equal(addTemplateWidget(t, { id: "extra", kind: "TEXT", title: "x", text: "y" }).ok, false);
  assert.equal(addTemplateWidget(t, { id: "bad", kind: "CHART", title: "x", chart: { kind: "BAR", template: "INDICATOR_OVER_TIME", roleKeys: ["no_such_role"], measure: "PERIOD", showTarget: false } }).ok, false);
  t = ok(addTemplateWidget(t, { id: "note", kind: "TEXT", title: "Note", text: "Figures are cumulative to date.", w: 12, h: 2 }));
  t = ok(updateTemplateWidget(t, "extra", { title: "Hygiene reach" }));
  assert.equal(t.widgets.find((w) => w.id === "extra").title, "Hygiene reach");
  assert.equal(updateTemplateWidget(t, "extra", { chart: { kind: "BAR", template: "INDICATOR_OVER_TIME", roleKeys: [], measure: "PERIOD", showTarget: false } }).ok, false);
  t = ok(moveTemplateWidget(t, "progress", 0, 20));
  t = ok(resizeTemplateWidget(t, "trend-1", 12, 5));
  const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  for (const a of t.widgets) for (const b of t.widgets) if (a !== b) assert.ok(!overlap(a, b), `${a.id}/${b.id}`);
  t = ok(removeTemplateWidget(t, "extra"));
  assert.ok(!t.widgets.some((w) => w.id === "extra"));
  assert.equal(removeTemplateWidget(t, "extra").ok, false);
  assert.equal(moveTemplateWidget(t, "nope", 0, 0).ok, false);
  assert.deepEqual(templateProblems(t), []);
  assert.equal(t.status, "DRAFT");
});

test("no editing tool can leave a template that cannot be applied", () => {
  const t = copyTemplate(wash, { id: "o" });
  assert.equal(updateTemplateDetails(t, { title: " " }).ok, false);
  assert.equal(updateTemplateDetails(t, { description: "x".repeat(501) }).ok, false);
  const many = { ...t, widgets: Array.from({ length: 24 }, (_, i) => ({ id: `w${i}`, kind: "TEXT", title: "t", text: "x", x: 0, y: i * 2, w: 12, h: 2 })) };
  assert.equal(addTemplateWidget(many, { id: "one-more", kind: "TEXT", title: "t", text: "x" }).ok, false);
});
