import { CHART_PALETTES } from "@donordesk/domain/contexts/reporting/data-charts.js";

/** The parts of a canvas theme a chart takes its colours from. */
export interface ChartThemeColours { palette: readonly string[]; line: string; muted: string; body: string; ink: string }

const same = (a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean => a.length === b.length && a.every((x, i) => x.toLowerCase() === b[i]!.toLowerCase());
const axisOf = (colours: ChartThemeColours) => (a: unknown): unknown => (a && typeof a === "object"
  ? { ...(a as Record<string, unknown>), axisLine: { lineStyle: { color: colours.line } }, axisTick: { lineStyle: { color: colours.line } }, axisLabel: { ...((a as { axisLabel?: object }).axisLabel ?? {}), color: colours.muted }, splitLine: { lineStyle: { color: colours.line } } }
  : a);

/**
 * A chart on screen takes the page's theme the way a file does (the same rule as the exporter's `themedOption`): the product's own default
 * colours give way to the theme's palette, a colour set a person chose (their own, a named palette or a theme) is kept, and axes and lines
 * follow the theme. Returns a new option; the drawing it came from is never changed.
 */
export function themeChartOption(option: Record<string, unknown>, colours: ChartThemeColours): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(option)) as Record<string, unknown>;
  const chosen = Array.isArray(clone.color) && !same(clone.color as string[], CHART_PALETTES[0]!.colors);
  if (chosen) return clone;
  if (Array.isArray(clone.series)) {
    for (const item of clone.series as Array<Record<string, unknown>>) {
      for (const key of ["itemStyle", "lineStyle", "areaStyle"] as const) {
        const style = item[key] as Record<string, unknown> | undefined;
        if (style && typeof style === "object") delete style.color;
      }
    }
  }
  const axis = axisOf(colours);
  const out: Record<string, unknown> = { ...clone, color: [...colours.palette] };
  if (clone.xAxis !== undefined) out.xAxis = Array.isArray(clone.xAxis) ? clone.xAxis.map(axis) : axis(clone.xAxis);
  if (clone.yAxis !== undefined) out.yAxis = Array.isArray(clone.yAxis) ? clone.yAxis.map(axis) : axis(clone.yAxis);
  return out;
}
