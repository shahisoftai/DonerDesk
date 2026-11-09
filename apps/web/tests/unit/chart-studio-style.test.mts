import assert from "node:assert/strict";
import test from "node:test";
import { pruneStyleForKind, groupsFor, styleValue, withStyleValue, resetGroup, resetLook, withBands, changedIn, humanize, groupOfEvent, withClickTargets } from "../../src/features/charts/domain/studio-style.ts";
import { initialSpec, withKind, withTemplate } from "../../src/features/charts/domain/studio-state.ts";
import { optionForMode } from "../../src/features/design/domain/chart-mode.ts";
import { applyPreset } from "@donordesk/domain/contexts/reporting/chart-presets.js";
import { STYLE_FIELDS, STYLE_GROUPS, inScope } from "@donordesk/domain/contexts/reporting/chart-style.js";
import { CHART_KIND_ORDER, CHART_KINDS, validateChartSpec } from "@donordesk/domain/contexts/reporting/chart-spec-v2.js";
import { DARK_ROLES } from "@donordesk/domain/contexts/reporting/chart-theme-roles.js";
import { MESSAGES } from "../../src/features/i18n/messages/index.ts";

const bar = initialSpec(["i1"]);

test("a chart type is offered only the groups that apply to it", () => {
  const names = (kind: string) => groupsFor(kind as never).map((g) => g.group);
  assert.ok(names("BAR").includes("bars") && !names("BAR").includes("pie") && !names("BAR").includes("gauge"));
  assert.ok(names("DONUT").includes("pie") && !names("DONUT").includes("bars"));
  assert.ok(names("GAUGE").includes("gauge"), "the gauge group is offered for a gauge even though its bands are not a plain field");
  assert.ok(names("PICTORIAL_BAR").includes("pictorial"));
  for (const kind of CHART_KIND_ORDER.filter((k) => CHART_KINDS[k].status === "BUILT")) {
    const offered = new Set(groupsFor(kind).flatMap((g) => g.fields.map((f) => f.path)));
    for (const f of STYLE_FIELDS) assert.equal(offered.has(f.path), inScope(f.scope, kind), `${kind} ${f.path}`);
  }
  assert.deepEqual(groupsFor("BAR").map((g) => g.label).slice(0, 3), ["Text", "Background", "Title"]);
  assert.equal(new Set(STYLE_GROUPS.map((g) => g.label)).size, STYLE_GROUPS.length);
});

test("setting an option, clearing it, and an empty style being removed", () => {
  const a = withStyleValue(bar, "bars.radius", 6);
  assert.equal(styleValue(a, "bars.radius"), 6);
  assert.equal(changedIn(a, "bars"), 1);
  const b = withStyleValue(a, "bars.width", 20);
  assert.deepEqual(b.style, { bars: { radius: 6, width: 20 } });
  const c = withStyleValue(b, "bars.radius", undefined);
  assert.deepEqual(c.style, { bars: { width: 20 } });
  assert.equal(withStyleValue(c, "bars.width", Number.NaN).style, undefined, "an empty or non-number entry clears the option and the style");
  assert.equal(withStyleValue(bar, "title.align", "").style, undefined);
  assert.equal(bar.style, undefined, "the input is not changed");
});

test("every edit the panel can make keeps the spec valid", () => {
  for (const f of STYLE_FIELDS.filter((x) => inScope(x.scope, "BAR"))) {
    const v = f.type === "number" ? f.min : f.type === "choice" ? f.options[f.options.length - 1] : f.type === "flag" ? true : "x";
    assert.deepEqual(validateChartSpec(withStyleValue(bar, f.path, v)), [], f.path);
  }
});

test("resetting a group leaves the others; resetting the look removes a theme but keeps a named palette", () => {
  const s = withStyleValue(withStyleValue(bar, "bars.radius", 6), "title.size", 20);
  assert.deepEqual(resetGroup(s, "bars").style, { title: { size: 20 } });
  assert.equal(resetGroup(resetGroup(s, "bars"), "title").style, undefined);
  const themed = applyPreset(withStyleValue(initialSpec(["i1"]), "bars.radius", 4), "echarts-vintage")!;
  assert.equal(resetLook(themed).paletteId, undefined);
  assert.equal(resetLook({ ...s, paletteId: "OCEAN" }).paletteId, "OCEAN");
  assert.equal(resetLook({ ...s, paletteId: "OCEAN" }).style, undefined);
});

test("gauge bands are set and cleared as a whole", () => {
  const g = { ...bar, kind: "GAUGE" as const };
  const a = withBands(g, [{ upTo: 40, tone: "NEGATIVE" }, { upTo: 100, tone: "POSITIVE" }]);
  assert.equal(((a.style as { gauge: { bands: unknown[] } }).gauge.bands).length, 2);
  assert.equal(withBands(a, []).style, undefined);
});

test("a click on the picture opens the group it belongs to", () => {
  assert.equal(groupOfEvent({ componentType: "series", seriesType: "bar" }), "bars");
  assert.equal(groupOfEvent({ componentType: "series", seriesType: "line" }), "lines");
  assert.equal(groupOfEvent({ componentType: "series", seriesType: "pie" }), "pie");
  assert.equal(groupOfEvent({ componentType: "series", seriesType: "scatter", seriesName: "icons" }), "pictorial");
  assert.equal(groupOfEvent({ componentType: "title" }), "title");
  assert.equal(groupOfEvent({ componentType: "xAxis" }), "xAxis");
  assert.equal(groupOfEvent({ componentType: "legend" }), "legend");
  assert.equal(groupOfEvent({ componentType: "series", seriesType: "boxplot" }), "effects");
  assert.equal(groupOfEvent({}), null);
  const o = withClickTargets({ title: { text: "T" }, xAxis: { type: "category" }, yAxis: [{ type: "value" }, { type: "value" }], series: [] });
  assert.equal((o.title as { triggerEvent: boolean }).triggerEvent, true);
  assert.equal((o.xAxis as { triggerEvent: boolean }).triggerEvent, true);
  assert.ok((o.yAxis as Array<{ triggerEvent: boolean }>).every((a) => a.triggerEvent));
});

test("a dark screen swaps role colours and a theme's own colours; a light one changes nothing", () => {
  const themed = applyPreset(bar, "echarts-vintage")!;
  const light = { color: ["#d87c7c"], textStyle: { color: "#333333" } };
  assert.equal(optionForMode(light, "light", themed.paletteId), light);
  const dark = optionForMode(light, "dark", themed.paletteId);
  assert.equal((dark.textStyle as { color: string }).color, DARK_ROLES.text);
  assert.notDeepEqual(dark.color, light.color);
  assert.deepEqual(optionForMode({ color: ["#123456"] }, "dark", "OCEAN").color, ["#123456"], "a named palette is left alone");
});

test("words are readable", () => {
  assert.equal(humanize("ROUND_RECT"), "Round rect");
  assert.equal(humanize("NONE"), "None");
});

test("every style label of the panel exists in all four languages", () => {
  for (const lang of ["en", "fr", "es", "ar"] as const) {
    const m = MESSAGES[lang] as Record<string, string>;
    for (const k of ["studio.look", "studio.look.preset", "studio.look.presetNone", "studio.look.reset", "studio.look.resetAll", "studio.look.clicked", "studio.look.hint", "studio.look.on", "studio.look.off", "studio.look.default", "studio.look.screenOnly", "studio.look.band.add", "studio.look.tone.NEGATIVE", "kind.PICTORIAL_BAR", "kind.MULTI_RING", "kind.TREE"]) assert.ok(m[k] && m[k].length > 0, `${lang} ${k}`);
  }
});

test("changing the chart type drops the style groups it cannot use, so the chart can still be saved", () => {
  const styled = withStyleValue(withStyleValue(initialSpec(["i1"]), "bars.radius", 6), "title.size", 20);
  const line = withKind(styled, "LINE")!;
  assert.deepEqual(line.style, { title: { size: 20 } }, "bar settings are gone, the title stays");
  assert.deepEqual(validateChartSpec(line), []);
  assert.equal(pruneStyleForKind(styled), styled, "nothing to drop on a bar chart: the same object");
  const toTarget = withTemplate(withBands({ ...initialSpec(["i1"]), kind: "GAUGE", dataset: { ...initialSpec(["i1"]).dataset, template: "INDICATOR_VS_TARGET" } }, [{ upTo: 50, tone: "NEUTRAL" }]), "INDICATOR_VS_TARGET", ["i1"]);
  assert.deepEqual(validateChartSpec(withKind(toTarget, "FILL_GAUGE")!), [], "a gauge's bands do not follow it to a fill gauge");
});
