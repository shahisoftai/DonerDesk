import { contrastRatio, relativeLuminance } from "../infographics/theme.js";
import { mixHex } from "./chart-color.js";
import { CHART_PALETTES } from "./data-charts.js";
import { DARK_ROLES, LIGHT_ROLES } from "./chart-theme-roles.js";
import { ECHARTS_THEMES, ECHARTS_THEME_SOURCE } from "./chart-presets-data.js";
import { validateChartStyle, type ChartStyle } from "./chart-style.js";
import type { ChartSpecV2 } from "./chart-spec-v2.js";

/**
 * Chart style presets (Phase 47.1): a named palette plus the style choices a theme implies. The stock ECharts themes are generated into
 * `chart-presets-data.ts` from the `echarts` package (Apache-2.0); the product's own look is the first preset and carries no style at all.
 * A preset is applied as an ordinary edit (`applyPreset` returns a new spec), so exports, dashboards and undo need nothing special.
 * Pure: no chart library import.
 */

export type PresetMode = "light" | "dark";
export const PRESET_PALETTE_PREFIX = "preset:";
/** Marks need 3:1 against the surface they sit on (the same minimum the design tokens are held to). */
export const MARK_CONTRAST = 3;
export const CHART_PRESET_CREDIT = `Chart themes: Apache ECharts ${ECHARTS_THEME_SOURCE.version}, ${ECHARTS_THEME_SOURCE.licence}, © The Apache Software Foundation.`;

export interface ChartStylePreset {
  id: string;
  label: string;
  source: "DONORDESK" | "ECHARTS";
  /** The colours as the source defined them; `presetColors` returns them fitted to a surface. */
  colors: string[];
  /** The theme was made for a dark surface (its own background is dark). */
  forDark: boolean;
  style: ChartStyle;
}

const SURFACE: Record<PresetMode, string> = { light: LIGHT_ROLES.surface, dark: DARK_ROLES.surface };

/**
 * A colour that keeps its hue but reads against a surface: unchanged when it already has `min` contrast, otherwise mixed toward black
 * (on a light surface) or white (on a dark one) in 4% steps until it does. Deterministic; the order and count of a palette never change.
 */
export function fitToSurface(colour: string, surface: string, min: number = MARK_CONTRAST): string {
  if (contrastRatio(colour, surface) >= min) return colour;
  const target = relativeLuminance(surface) > 0.5 ? "#000000" : "#ffffff";
  for (let step = 1; step <= 25; step++) {
    const candidate = mixHex(colour, target, step * 0.04);
    if (contrastRatio(candidate, surface) >= min) return candidate;
  }
  return target;
}

const DONORDESK_COLOURS = CHART_PALETTES[0]!.colors;

/** The product's own presets besides its default look: a modern one, one that prints well in black and white, and a quiet one. */
const OWN_PRESETS: ReadonlyArray<ChartStylePreset> = [
  {
    id: "donordesk-modern", label: "DonorDesk Modern", source: "DONORDESK", forDark: false,
    colors: ["#2563eb", "#d97706", "#059669", "#7c3aed", "#dc2626", "#0891b2", "#be185d", "#4d7c0f"],
    style: { bars: { radius: 6, gradient: true }, lines: { width: 3, roundCaps: true, symbol: "CIRCLE", symbolSize: 7 }, area: { fade: true, opacity: 0.4 }, legend: { icon: "CIRCLE" }, tooltip: { pointer: "SHADOW" }, xAxis: { showLine: false }, yAxis: { gridlines: "DOTTED" }, animation: { easing: "CUBIC_OUT", duration: 500 } },
  },
  {
    id: "donordesk-print", label: "DonorDesk Print (black and white safe)", source: "DONORDESK", forDark: false,
    colors: ["#111827", "#4b5563", "#6b7280", "#374151", "#1f2937", "#52525b"],
    style: { effects: { decals: true }, bars: { borderWidth: 1 }, lines: { width: 2, symbol: "RECT", symbolSize: 6 }, legend: { icon: "RECT" }, animation: { enabled: false } },
  },
  {
    id: "donordesk-quiet", label: "DonorDesk Quiet", source: "DONORDESK", forDark: false,
    colors: ["#1e3a8a", "#2563eb", "#3b82f6", "#0f766e", "#64748b", "#475569"],
    style: { yAxis: { gridlines: "NONE" }, xAxis: { showLine: true }, legend: { icon: "CIRCLE" }, tooltip: { pointer: "LINE" } },
  },
];

export const CHART_STYLE_PRESETS: ReadonlyArray<ChartStylePreset> = [
  { id: "donordesk", label: "DonorDesk", source: "DONORDESK", colors: DONORDESK_COLOURS, forDark: false, style: {} },
  ...OWN_PRESETS,
  ...ECHARTS_THEMES.map((t): ChartStylePreset => ({
    id: `echarts-${t.id}`, label: t.label, source: "ECHARTS", colors: t.colors,
    forDark: t.background !== undefined && relativeLuminance(t.background) < 0.2,
    style: t.lineWidth !== undefined || t.smooth !== undefined ? { lines: { ...(t.lineWidth !== undefined ? { width: t.lineWidth } : {}), ...(t.smooth !== undefined ? { smooth: t.smooth } : {}) } } : {},
  })),
];

const byId = new Map(CHART_STYLE_PRESETS.map((p) => [p.id, p]));
export const presetById = (id: string): ChartStylePreset | undefined => byId.get(id);

/** A preset's colours fitted to the surface of a mode (every colour reads at 3:1 or better there). */
export function presetColors(id: string, mode: PresetMode): string[] | undefined {
  const p = byId.get(id);
  return p?.colors.map((c) => fitToSurface(c, SURFACE[mode]));
}

/**
 * The colours a `paletteId` stands for in a stored or exported (light) picture: a named palette, or a preset (`preset:<id>`).
 * A screen in dark mode asks `presetColors(id, "dark")` for the same preset. Unknown ids answer undefined.
 */
export function resolvePaletteColors(paletteId: string | undefined): string[] | undefined {
  if (paletteId === undefined) return undefined;
  const named = CHART_PALETTES.find((p) => p.id === paletteId);
  if (named) return named.colors;
  return paletteId.startsWith(PRESET_PALETTE_PREFIX) ? presetColors(paletteId.slice(PRESET_PALETTE_PREFIX.length), "light") : undefined;
}

/**
 * The spec with a preset applied: its palette replaces the colours, its style replaces the spec's style, and a series colour a person
 * chose stays. Style groups that do not apply to this chart type are left out rather than refused. Null for an unknown preset.
 */
export function applyPreset(spec: ChartSpecV2, presetId: string): ChartSpecV2 | null {
  const p = byId.get(presetId);
  if (!p) return null;
  const refused = new Set(validateChartStyle(p.style, spec.kind).filter((x) => x.code === "STYLE_NOT_FOR_KIND").map((x) => x.path.replace(/^style\./, "")));
  const style = Object.fromEntries(Object.entries(p.style).filter(([group]) => !refused.has(group))) as ChartStyle;
  const { colors: _colors, style: _style, ...rest } = spec;
  void _colors; void _style;
  return { ...rest, paletteId: `${PRESET_PALETTE_PREFIX}${p.id}`, ...(Object.keys(style).length > 0 ? { style } : {}) };
}
