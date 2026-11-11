import { buildChart, type ChartBuild } from "../../reporting/chart-render.js";
import { CHART_KINDS, validateChartSpec, type ChartSpecV2 } from "../../reporting/chart-spec-v2.js";
import type { DatasetResult } from "../../reporting/dataset-query.js";
import { projectSlot } from "../binding.js";
import { defineBlock } from "../block-definition.js";
import { contrastRatio } from "../../infographics/theme.js";
import { MARK_CONTRAST } from "../../reporting/chart-presets.js";

export interface ChartProps { spec: ChartSpecV2 }

/** Any Chart Studio chart. The one builder and the one validator are the studio's own, so a chart means the same everywhere. */
export const chartBlock = defineBlock<ChartProps, Extract<ChartBuild, { ok: true }>, DatasetResult>({
  kind: "CHART",
  family: "CHARTS",
  labelKey: "canvas.block.CHART",
  requiresSetup: true,
  needsAlt: true,
  // A bar-like chart grows, a trend draws, anything else (a map, a flow, a ring) only fades.
  picture: ({ spec }) => { const rule = spec ? CHART_KINDS[spec.kind] : undefined; return rule?.startsAtZero ? "CHART_BAR" : rule?.family === "TREND" ? "CHART_LINE" : "OTHER"; },
  highlightable: ({ spec }) => { const rule = spec ? CHART_KINDS[spec.kind] : undefined; return Boolean(rule) && !["TREND", "GEOGRAPHIC", "SCHEDULE", "RELATIONSHIP"].includes(rule!.family); },
  defaults: () => ({ spec: undefined as unknown as ChartSpecV2 }),
  validate: ({ spec }) => (spec ? validateChartSpec(spec).slice(0, 1).map((p) => ({ message: p.message })) : [{ message: "A chart needs its settings." }]),
  slots: [projectSlot(["PERIOD", "DRAFTS"])],
  sizes: { min: { w: 3, h: 3 }, max: { w: 12, h: 10 }, default: { w: 6, h: 4 } },
  lint: [
    // Five or more colours cannot all be told apart by everyone, or in black and white: patterns carry the difference as well.
    { id: "CHART_MANY_COLOURS_NO_PATTERN", severity: "TIP", check: (p) => { const spec = (p as ChartProps).spec; return spec && spec.dataset.indicatorIds.length >= 5 && spec.style?.effects?.decals !== true ? "This chart has five or more colours. Turn on \"Patterns as well as colour\" so it reads in black and white and for readers who cannot tell colours apart." : null; } },
    // A colour the person chose, or a theme's, that is too pale to see against a white page.
    { id: "CHART_COLOUR_TOO_PALE", severity: "WARN", check: (p) => { const spec = (p as ChartProps).spec; const own = [...(spec?.colors ?? []), ...(spec?.series ?? []).flatMap((s) => (s.color ? [s.color] : []))].filter((c) => /^#[0-9a-f]{6}$/i.test(c)); const pale = own.filter((c) => contrastRatio(c, "#ffffff") < MARK_CONTRAST); return pale.length > 0 ? `${pale.length === 1 ? "A colour" : "Some colours"} (${pale.slice(0, 3).join(", ")}) ${pale.length === 1 ? "is" : "are"} too pale to see clearly against a white page. Choose a darker one.` : null; } },
  ],
  resolve: ({ spec }, data) => { if (!data || !spec) return { state: "unavailable", reason: "The figures are read when this is opened." }; const r = buildChart(spec, data); return r.ok ? { state: "ready", model: r, notes: [] } : { state: "unavailable", reason: r.reason }; },
});
