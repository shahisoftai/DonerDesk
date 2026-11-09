import assert from "node:assert/strict";
import test from "node:test";
import { toLegacySpec } from "../dist/contexts/reporting/chart-spec-v2.js";
import { CHART_STYLE_PRESETS, CHART_PALETTES, applyPreset, buildChart, fitToSurface, presetColors, presetById, resolvePaletteColors, resolveDataset, validateChartSpec, CHART_PRESET_CREDIT } from "../dist/index.js";
import { contrastRatio } from "../dist/contexts/infographics/theme.js";
import { LIGHT_ROLES, DARK_ROLES } from "../dist/contexts/reporting/chart-theme-roles.js";

const periods = ["Jan", "Feb", "Mar"].map((label, i) => ({ id: `p${i + 1}`, label, start: `2026-0${i + 1}-01`, end: `2026-0${i + 1}-28`, reportType: "MONTHLY", locked: false }));
const sheet = { projectId: "x", periods, finance: [], indicators: [{ id: "a", code: "A", name: "A", level: "OUTPUT", type: "COUNT", unit: "people", baseline: "1", target: "9", isRate: false }], cells: [10, 20, 30].map((v, i) => ({ indicatorId: "a", periodId: `p${i + 1}`, periodValue: String(v), cumulativeValue: String(v), status: "VERIFIED" })) };
const spec = (kind, over = {}) => ({ version: 2, kind, dataset: { template: "INDICATOR_OVER_TIME", indicatorIds: ["a"], measure: "PERIOD", showTarget: false, includeDraft: true }, ...over });

test("the catalogue holds the product look first and every stock ECharts theme", () => {
  assert.equal(CHART_STYLE_PRESETS[0].id, "donordesk");
  assert.deepEqual(CHART_STYLE_PRESETS[0].style, {});
  assert.equal(CHART_STYLE_PRESETS.length, 40);
  assert.equal(new Set(CHART_STYLE_PRESETS.map((p) => p.id)).size, 40);
  assert.deepEqual(CHART_STYLE_PRESETS.slice(0, 4).map((p) => p.id), ["donordesk", "donordesk-modern", "donordesk-print", "donordesk-quiet"]);
  for (const p of CHART_STYLE_PRESETS) {
    assert.ok(p.colors.length >= 4, p.id);
    for (const c of p.colors) assert.match(c, /^#[0-9a-f]{6}$/, p.id);
  }
  assert.match(CHART_PRESET_CREDIT, /Apache ECharts 6\./);
});

test("every preset reads at 3:1 on a light and on a dark surface, keeping its order and count", () => {
  for (const p of CHART_STYLE_PRESETS) {
    for (const [mode, surface] of [["light", LIGHT_ROLES.surface], ["dark", DARK_ROLES.surface]]) {
      const fitted = presetColors(p.id, mode);
      assert.equal(fitted.length, p.colors.length, `${p.id} ${mode}`);
      fitted.forEach((c, i) => {
        assert.ok(contrastRatio(c, surface) >= 3, `${p.id} ${mode} colour ${i} ${c}`);
        if (contrastRatio(p.colors[i], surface) >= 3) assert.equal(c, p.colors[i], "a colour that already reads is never changed");
      });
    }
  }
});

test("fitting is deterministic and settles", () => {
  assert.equal(fitToSurface("#f2d643", "#ffffff"), fitToSurface("#f2d643", "#ffffff"));
  const once = fitToSurface("#ebdba4", "#ffffff");
  assert.equal(fitToSurface(once, "#ffffff"), once);
  assert.equal(fitToSurface("#0b3c5d", "#ffffff"), "#0b3c5d");
  assert.ok(contrastRatio(fitToSurface("#222222", "#12231f"), "#12231f") >= 3);
});

test("the themes made for a dark surface are marked", () => {
  assert.equal(presetById("echarts-dark").forDark, true);
  assert.equal(presetById("echarts-dark-blue").forDark, true);
  assert.equal(presetById("echarts-vintage").forDark, false);
});

test("applying a preset swaps palette and style, keeps a person's series colour, and drops style the chart cannot use", () => {
  const own = spec("BAR", { colors: ["#111111"], series: [{ index: 0, color: "#ff0000" }], title: "T" });
  const a = applyPreset(own, "echarts-macarons2");
  assert.equal(a.paletteId, "preset:echarts-macarons2");
  assert.equal(a.colors, undefined);
  assert.equal(a.style, undefined, "line settings do not apply to a bar chart");
  assert.deepEqual(a.series, own.series);
  assert.equal(a.title, "T");
  assert.equal(applyPreset(spec("LINE"), "echarts-macarons2").style.lines.width, 2);
  assert.equal(applyPreset(own, "nope"), null);
  assert.equal(applyPreset(spec("LINE", { style: { lines: { width: 9 } } }), "donordesk").style, undefined, "the product look carries no style");
  assert.equal(own.paletteId, undefined, "the input spec is not changed");
});

test("every preset gives a valid spec for a bar, a line, a pie and an area", () => {
  for (const p of CHART_STYLE_PRESETS) for (const kind of ["BAR", "LINE", "AREA", "PIE"]) {
    const s = applyPreset(spec(kind, kind === "PIE" ? { dataset: { template: "INDICATORS_PROGRESS", indicatorIds: ["a"], measure: "PERIOD", showTarget: false, includeDraft: true } } : {}), p.id);
    assert.deepEqual(validateChartSpec(s), [], `${p.id} ${kind}`);
  }
});

test("a chart drawn with a preset uses its light colours; a named palette is unchanged", () => {
  const drawn = (s) => buildChart(s, resolveDataset(sheet, { indicatorIds: ["a"], measure: "PERIOD", includeDraft: true })).option.color;
  assert.deepEqual(drawn(applyPreset(spec("BAR"), "echarts-vintage")), presetColors("echarts-vintage", "light"));
  assert.deepEqual(drawn(spec("BAR", { paletteId: "OCEAN" })), CHART_PALETTES.find((p) => p.id === "OCEAN").colors);
  assert.deepEqual(drawn(spec("BAR")), CHART_PALETTES[0].colors);
});

test("an unknown colour set is named; the known ones are accepted", () => {
  assert.deepEqual(validateChartSpec(spec("BAR", { paletteId: "NOPE" })).map((p) => `${p.code}@${p.path}`), ["UNKNOWN_SETTING@paletteId"]);
  assert.deepEqual(validateChartSpec(spec("BAR", { paletteId: "preset:echarts-roma" })), []);
  assert.deepEqual(validateChartSpec(spec("BAR", { paletteId: "OCEAN" })), []);
  assert.equal(resolvePaletteColors("preset:zzz"), undefined);
});

test("the modern preset rounds, fades and softens a bar and an area chart, and the print preset adds patterns", () => {
  const draw = (s) => buildChart(s, resolveDataset(sheet, { indicatorIds: ["a"], measure: "PERIOD", includeDraft: true })).option;
  const bar = draw(applyPreset(spec("BAR"), "donordesk-modern")).series[0];
  assert.deepEqual(bar.itemStyle.borderRadius, [6, 6, 0, 0]);
  assert.equal(bar.itemStyle.color.type, "linear");
  const area = draw(applyPreset(spec("AREA"), "donordesk-modern")).series[0];
  assert.equal(area.lineStyle.width, 3);
  assert.equal(area.areaStyle.color.type, "linear");
  assert.equal(draw(applyPreset(spec("BAR"), "donordesk-print")).aria.decal.show, true);
  assert.equal(applyPreset(spec("PIE", { dataset: { template: "INDICATORS_PROGRESS", indicatorIds: ["a"], measure: "PERIOD", showTarget: false, includeDraft: true } }), "donordesk-modern").style.bars, undefined, "bar settings are not put on a pie");
});

test("a chart sent to a file carries the colours of the theme or palette chosen, but not the product's default", () => {
  const legacy = (over) => toLegacySpec({ ...spec("BAR", { dataset: { template: "INDICATOR_OVER_TIME", indicatorIds: ["a"], measure: "PERIOD", showTarget: false, includeDraft: true } }), ...over });
  assert.deepEqual(legacy(applyPreset(spec("BAR"), "echarts-vintage")).colors, presetColors("echarts-vintage", "light"));
  assert.deepEqual(legacy({ paletteId: "OCEAN" }).colors, CHART_PALETTES.find((p) => p.id === "OCEAN").colors);
  assert.equal(legacy({ paletteId: "STANDARD" }).colors, undefined);
  assert.equal(legacy({}).colors, undefined);
  assert.deepEqual(legacy({ colors: ["#123456"], paletteId: "OCEAN" }).colors, ["#123456"], "explicit colours win");
});
