import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error: a test-support module of the domain package (plain JavaScript)
import { CASES, EXTRA, ALL, sheet, spec, measureFor } from "../../../../packages/domain/test/support/chart-fixtures.mjs";
import { buildChart, resolveDataset, datasetQueryFor, CHART_KIND_ORDER, CHART_KINDS, applyScreenInteraction } from "@donordesk/domain";
import { REGISTERED_COMPONENTS, REGISTERED_SERIES } from "../../src/lib/client/echarts-slim.ts";

/**
 * The browser's chart library registers only what we draw (`echarts-slim.ts`). A chart whose series or component is not registered draws
 * nothing, silently, so every drawable chart kind is built here (plain, heavily styled, and with the screen-only zoom and picture button) and
 * every series type and option key it uses must be on the lists.
 */
const COMPONENT_KEYS = new Set(["grid", "legend", "tooltip", "dataZoom", "visualMap", "geo", "graphic", "aria", "title", "toolbox", "polar", "radar", "singleAxis", "parallel", "parallelAxis", "calendar", "angleAxis", "radiusAxis", "axisPointer", "xAxis", "yAxis", "dataset", "markLine", "markPoint", "markArea", "timeline", "brush"]);

test("every series and component our chart builders emit is registered in the slim chart library", () => {
  const series = new Set<string>(), components = new Set<string>();
  const scan = (o: unknown, depth = 0): void => {
    if (!o || typeof o !== "object" || depth > 12) return;
    if (Array.isArray(o)) { o.forEach((x) => scan(x, depth + 1)); return; }
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (k === "series" && v) for (const s of ([] as unknown[]).concat(v)) { const t = (s as { type?: string })?.type; if (t) series.add(t); scan(s, depth + 1); }
      else { if (COMPONENT_KEYS.has(k) || ["markLine", "markPoint", "markArea"].includes(k)) components.add(k); scan(v, depth + 1); }
    }
  };
  let built = 0;
  for (const kind of CHART_KIND_ORDER.filter((k: string) => CHART_KINDS[k].status === "BUILT" && CASES[k])) {
    const [template, ids] = CASES[kind];
    for (const style of [undefined, { labels: { show: true }, marks: { highest: true, average: true }, zoom: { bar: true } }]) {
      const s = spec(kind, template, ids, { dataset: { measure: measureFor(kind) }, ...(style ? { style } : {}) });
      const b = buildChart(s, { ...resolveDataset(sheet, datasetQueryFor(s, ALL)), ...EXTRA });
      if (!b.ok || !b.option) continue;
      built += 1;
      scan(b.option);
      scan(applyScreenInteraction(JSON.parse(JSON.stringify(b.option)), s));
    }
  }
  assert.ok(built > 40, `built ${built} charts`);
  assert.deepEqual([...series].filter((t) => !(REGISTERED_SERIES as readonly string[]).includes(t)), [], "a series type is not registered");
  assert.deepEqual([...components].filter((c) => !(REGISTERED_COMPONENTS as readonly string[]).includes(c)), [], "a component is not registered");
});
