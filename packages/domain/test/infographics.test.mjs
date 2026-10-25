import test from "node:test";
import assert from "node:assert/strict";
import {
  validateConfig,
  configFromTemplate,
  knownTemplates,
  templateById,
  INFOGRAPHIC_TEMPLATES,
  INFOGRAPHIC_TEMPLATE_IDS,
  DEFAULT_SECTION_LABEL,
  buildProvenance,
  provenanceFooter,
} from "../dist/index.js";

const base = () => configFromTemplate("RESULTS", "Donor pack");

test("the registry holds exactly the six templates, each with sections that validate", () => {
  assert.deepEqual([...INFOGRAPHIC_TEMPLATE_IDS].sort(), ["BUDGET", "CLOSURE", "OVERVIEW", "PROGRESS", "RESULTS", "THEMATIC"]);
  for (const id of INFOGRAPHIC_TEMPLATE_IDS) {
    const template = INFOGRAPHIC_TEMPLATES[id];
    assert.ok(template.label.length > 0);
    assert.ok(template.sections.length > 0, `${id} starts with slots, never a blank page`);
    const validated = validateConfig(configFromTemplate(id), knownTemplates());
    assert.equal(validated.ok, true, `${id} defaults validate`);
  }
});

test("an unknown template and a stale template version are refused", () => {
  const result = validateConfig({ ...base(), templateId: "POSTER" }, knownTemplates());
  assert.equal(result.ok, false);
  const stale = validateConfig({ ...base(), templateVersion: 99 }, knownTemplates());
  assert.equal(stale.ok, false, "a saved design pins the version it was made with");
});

test("a design needs sections; TEXT sections may start empty (template defaults do)", () => {
  assert.equal(validateConfig({ ...base(), sections: [] }, knownTemplates()).ok, false);
  const result = validateConfig({ ...base(), sections: [{ kind: "TEXT", title: "Lessons" }] }, knownTemplates());
  assert.equal(result.ok, true);
});

test("chart sections obey the chart template's indicator rule and allowed types", () => {
  const oneTooFew = validateConfig(
    { ...base(), sections: [{ kind: "CHART", chart: { template: "INDICATOR_OVER_TIME", indicatorIds: [], measure: "PERIOD", type: "LINE" } }] },
    knownTemplates(),
  );
  assert.equal(oneTooFew.ok, false, "an over-time chart needs exactly one indicator");
  const wrongType = validateConfig(
    { ...base(), sections: [{ kind: "CHART", chart: { template: "INDICATOR_OVER_TIME", indicatorIds: ["i1"], measure: "PERIOD", type: "GAUGE" } }] },
    knownTemplates(),
  );
  assert.equal(wrongType.ok, false, "an over-time chart cannot be a gauge");
  const noneChartWithIndicators = validateConfig(
    { ...base(), sections: [{ kind: "CHART", chart: { template: "STATUS_DISTRIBUTION", indicatorIds: ["i1"], measure: "PERIOD", type: "PIE" } }] },
    knownTemplates(),
  );
  assert.equal(noneChartWithIndicators.ok, false, "a status chart takes no indicators");
});

test("authored text is trimmed, length-capped, and everything unknown is dropped", () => {
  const result = validateConfig(
    {
      ...base(),
      title: "  Donor pack  ",
      sections: [{ kind: "TEXT", title: " Lessons ", text: "  We learned a lot.  ", bogus: undefined }],
    },
    knownTemplates(),
  );
  assert.equal(result.ok, true);
  assert.equal(result.value.title, "Donor pack");
  assert.equal(result.value.sections[0].title, "Lessons");
  assert.equal(result.value.sections[0].text, "We learned a lot.");
});

test("over-long authored text is refused, not truncated", () => {
  const result = validateConfig({ ...base(), sections: [{ kind: "TEXT", text: "x".repeat(601) }] }, knownTemplates());
  assert.equal(result.ok, false);
});

test("a config that drops to no visible sections still saves (empty states render)", () => {
  const result = validateConfig({ ...base(), sections: [{ kind: "KPIS", hidden: true }, { kind: "MAP" }] }, knownTemplates());
  assert.equal(result.ok, true);
});

test("every section kind has a default label — no slot renders without words", () => {
  for (const kind of ["KPIS", "CHART", "LOCATION_RESULTS", "LOCATION_COMPARISON", "REACH", "ACTIVITIES_BY_LOCATION", "MAP", "TEXT"]) {
    assert.ok(DEFAULT_SECTION_LABEL[kind].length > 0);
  }
});

test("provenance builds the footer once, for preview and export to share", () => {
  const provenance = buildProvenance({
    generatedAt: "2026-10-24T12:00:00.000Z",
    periodLabels: ["Jan – Mar 2026", "Apr – Jun 2026"],
    indicatorCodes: ["#1", "#2", "#3"],
    unverifiedCount: 2,
    notYetReportedCount: 1,
  });
  const footer = provenanceFooter(provenance);
  assert.match(footer, /Data: Jan – Mar 2026 – Apr – Jun 2026/);
  assert.match(footer, /2 values not yet verified/);
  assert.match(footer, /1 not yet reported/);
  assert.match(footer, /Generated 24 Oct 2026/);
  assert.match(footer, /Indicators #1 – #3/, "codes collapse to a range, not a full list");
  assert.equal(footer.includes("#2"), false, "the middle codes are not listed one by one");
});

test("a clean provenance says so in as few words as possible", () => {
  const footer = provenanceFooter(buildProvenance({ generatedAt: "2026-10-24T12:00:00.000Z", periodLabels: ["Jan – Mar 2026"] }));
  assert.equal(footer, "Data: Jan – Mar 2026 · Generated 24 Oct 2026");
});

test("templateById returns undefined for unknown ids and the label for known ones", () => {
  assert.equal(templateById("POSTER"), undefined);
  assert.equal(templateById("OVERVIEW")?.label, "Project Overview");
});
