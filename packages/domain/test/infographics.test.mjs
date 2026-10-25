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
  INFOGRAPHIC_SECTION_KINDS,
} from "../dist/index.js";

const base = () => configFromTemplate("RESULTS", "Donor pack");

test("the registry holds the six original templates plus the Phase 32 library, each with sections that validate", () => {
  for (const id of ["BUDGET", "CLOSURE", "OVERVIEW", "PROGRESS", "RESULTS", "THEMATIC"]) assert.ok(INFOGRAPHIC_TEMPLATE_IDS.includes(id), `${id} is still offered`);
  assert.ok(INFOGRAPHIC_TEMPLATE_IDS.length >= 16, "at least sixteen presets");
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
  for (const kind of INFOGRAPHIC_SECTION_KINDS) {
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

import { INFOGRAPHIC_THEMES, INFOGRAPHIC_THEME_IDS, resolveTheme, themeById, contrastRatio } from "../dist/index.js";

test("themes: every id has a theme; an unknown or missing id reads as DEFAULT", () => {
  for (const id of INFOGRAPHIC_THEME_IDS) assert.equal(INFOGRAPHIC_THEMES[id].id, id);
  assert.equal(resolveTheme(undefined).id, "DEFAULT");
  assert.equal(resolveTheme("NOPE").id, "DEFAULT");
  assert.equal(themeById("NOPE"), undefined);
});

test("themes: text tokens are readable on the card (WCAG AA 4.5:1); DEFAULT's three legacy tokens are the only exceptions", () => {
  const LEGACY = { DEFAULT: new Set(["accent", "subtle", "mapNote"]) };
  for (const id of INFOGRAPHIC_THEME_IDS) {
    const t = INFOGRAPHIC_THEMES[id];
    for (const token of ["ink", "body", "muted", "subtle", "accent", "warn", "mapLabel", "mapNote"]) {
      if (LEGACY[id]?.has(token)) continue;
      const bg = token.startsWith("map") ? t.mapWater : t.card;
      assert.ok(contrastRatio(t[token], bg) >= 4.5, `${id}.${token} ${contrastRatio(t[token], bg).toFixed(2)} on ${bg}`);
    }
    assert.ok(contrastRatio(t.ink, t.surface) >= 4.5, `${id} ink on surface`);
    assert.ok(t.palette.length >= 8, `${id} has a full series palette`);
    for (const c of [...t.palette, t.accent, t.page, t.card, ...Object.values(t.signals)]) assert.match(c, /^#[0-9a-f]{6}$/i);
  }
});

test("themes: the print theme's series stay distinguishable in greyscale", () => {
  const lum = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  };
  const first4 = INFOGRAPHIC_THEMES.PRINT_MONO.palette.slice(0, 4).map(lum).sort((a, b) => a - b);
  for (let i = 1; i < first4.length; i++) assert.ok(first4[i] - first4[i - 1] >= 30, "adjacent greys differ by at least 30/255");
});

test("themes: validateConfig keeps a known themeId, refuses an unknown one, and a design without one stays without", () => {
  const withTheme = validateConfig({ ...configFromTemplate("OVERVIEW"), themeId: "HIGH_CONTRAST" }, knownTemplates());
  assert.equal(withTheme.ok, true);
  assert.equal(withTheme.value.themeId, "HIGH_CONTRAST");
  assert.equal(validateConfig({ ...configFromTemplate("OVERVIEW"), themeId: "NEON" }, knownTemplates()).ok, false);
  const plain = validateConfig(configFromTemplate("OVERVIEW"), knownTemplates());
  assert.equal("themeId" in plain.value, false, "no themeId is written for a design that never chose one");
});
