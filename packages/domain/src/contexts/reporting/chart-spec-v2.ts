import type { ChartType } from "./chart-config.js";
import { DATA_CHART_TEMPLATES, HEX_COLOUR, type DataChartSpec, type DataChartTemplate, type LegacyDataChartTemplate } from "./data-charts.js";

const LEGACY_TEMPLATES: ReadonlySet<string> = new Set(["INDICATOR_OVER_TIME", "INDICATOR_VS_TARGET", "INDICATORS_PROGRESS", "INDICATORS_OVER_TIME", "STATUS_DISTRIBUTION", "FINANCE_BUDGET_VS_SPEND", "FINANCE_BURN_RATE"]);
import { CHART_MEASURES, type ChartMeasure } from "./data-sheet.js";

/**
 * Chart Spec v2 (Phase 34.0): the one description of a chart, used by the Data Center, dashboards, reports and infographics.
 * A spec stores choices, never data; every figure is drawn from the project's data sheet when the chart is opened.
 * Pure: the same spec is checked in the browser, the API and the exporter by `validateChartSpec`.
 *
 * v1 (`DataChartSpec`) is read through `migrateChartSpec` and never rewritten until someone saves; `toLegacySpec` lets the
 * existing renderer draw every v2 chart whose kind it already knows (status BUILT) while the other kinds wait for the studio.
 */

export type ChartFamily =
  | "COMPARISON" | "TREND" | "PART_TO_WHOLE" | "DISTRIBUTION" | "RELATIONSHIP" | "MATRIX" | "FLOW"
  | "PROGRESS" | "SCHEDULE" | "GEOGRAPHIC" | "COMBINATION" | "TABLE";

export type ChartKind =
  | "BAR" | "BAR_HORIZONTAL" | "BAR_GROUPED" | "BAR_STACKED" | "BAR_STACKED_100" | "LOLLIPOP" | "BULLET" | "DOT_PLOT"
  | "LINE" | "STEP_LINE" | "AREA" | "AREA_STACKED" | "SPARKLINE" | "SLOPE" | "CALENDAR_HEATMAP"
  | "PIE" | "DONUT" | "TREEMAP" | "SUNBURST" | "WAFFLE"
  | "HISTOGRAM" | "BOX_PLOT" | "POPULATION_PYRAMID"
  | "SCATTER" | "BUBBLE"
  | "HEATMAP"
  | "FUNNEL" | "WATERFALL" | "SANKEY"
  | "GAUGE" | "PROGRESS_RING" | "PROGRESS_BAR" | "KPI_NUMBER" | "RADAR"
  | "GANTT"
  | "CHOROPLETH" | "GRADUATED_SYMBOLS"
  | "BAR_LINE_COMBO"
  | "PIVOT_TABLE" | "SCORECARD_TABLE";

/**
 * The shape of data a chart is drawn from, decided by its dataset template:
 * SERIES_BY_PERIOD (one or more indicators across periods), LATEST (each indicator's latest value), TARGET_TRIPLE (one indicator's
 * baseline, target and latest result), STATUS (how many recorded values are verified, handed in or draft) and FINANCE (budget and
 * expenditure to date, or the share of the budget spent, by period), PLAN (the work plan's items), DAYS (completed activities per day) and
 * BUDGET (budget lines by donor and cost category, with what is spent).
 */
export type ChartShape = "SERIES_BY_PERIOD" | "LATEST" | "TARGET_TRIPLE" | "STATUS" | "FINANCE" | "PLAN" | "DAYS" | "BUDGET" | "PLACES";

/** The shape each dataset template yields. */
export const TEMPLATE_SHAPE: Record<DataChartTemplate, ChartShape | null> = {
  INDICATOR_OVER_TIME: "SERIES_BY_PERIOD",
  INDICATORS_OVER_TIME: "SERIES_BY_PERIOD",
  INDICATORS_PROGRESS: "LATEST",
  INDICATOR_VS_TARGET: "TARGET_TRIPLE",
  STATUS_DISTRIBUTION: "STATUS",
  FINANCE_BUDGET_VS_SPEND: "FINANCE",
  FINANCE_BURN_RATE: "FINANCE",
  PLAN_TIMELINE: "PLAN",
  ACTIVITY_DAYS: "DAYS",
  BUDGET_FLOW: "BUDGET",
  RESULTS_BY_PLACE: "PLACES",
};

export interface ChartKindRule {
  label: string;
  family: ChartFamily;
  /** BUILT: `buildChart` draws it. PLANNED: in the catalogue, needs data we do not hold yet (refused on save). */
  status: "BUILT" | "PLANNED";
  /** The v1 chart type this kind is drawn as by the older Data Center renderer, when it has one (the original six kinds). */
  legacyType?: ChartType;
  /** Counts and amounts only: a rate (percentage, ratio) is never stacked, sliced or summed. */
  additiveOnly: boolean;
  /** A bar-like mark: its axis starts at zero, always. */
  startsAtZero: boolean;
  /** Fewest values worth drawing (a distribution of three numbers says nothing). */
  minPoints: number;
  /** The data shapes this kind can honestly be drawn from. */
  shapes: ChartShape[];
}

const SBP: ChartShape = "SERIES_BY_PERIOD";
const LAT: ChartShape = "LATEST";
const TRI: ChartShape = "TARGET_TRIPLE";
const STA: ChartShape = "STATUS";
const FIN: ChartShape = "FINANCE";
const PLN: ChartShape = "PLAN";
const DAY: ChartShape = "DAYS";
const BUD: ChartShape = "BUDGET";
const PLC: ChartShape = "PLACES";

const kind = (label: string, family: ChartFamily, status: ChartKindRule["status"], shapes: ChartShape[], o: Partial<Pick<ChartKindRule, "legacyType" | "additiveOnly" | "startsAtZero" | "minPoints">> = {}): ChartKindRule => ({
  label,
  family,
  status,
  shapes,
  additiveOnly: false,
  startsAtZero: false,
  minPoints: 1,
  ...o,
});

/** Every chart kind and the rule for using it honestly. One table; a new kind is one row (the test walks it). */
export const CHART_KINDS: Record<ChartKind, ChartKindRule> = {
  BAR: kind("Bar", "COMPARISON", "BUILT", [SBP, LAT, TRI, STA, FIN, PLC], { legacyType: "BAR", startsAtZero: true }),
  BAR_HORIZONTAL: kind("Horizontal bar", "COMPARISON", "BUILT", [SBP, LAT, TRI, STA, PLC], { startsAtZero: true }),
  BAR_GROUPED: kind("Grouped bar", "COMPARISON", "BUILT", [SBP, FIN], { startsAtZero: true }),
  BAR_STACKED: kind("Stacked bar", "COMPARISON", "BUILT", [SBP], { additiveOnly: true, startsAtZero: true }),
  BAR_STACKED_100: kind("100% stacked bar", "COMPARISON", "BUILT", [SBP], { additiveOnly: true, startsAtZero: true, minPoints: 2 }),
  LOLLIPOP: kind("Lollipop", "COMPARISON", "BUILT", [LAT, TRI, PLC], { startsAtZero: true }),
  BULLET: kind("Bullet (value against target)", "COMPARISON", "BUILT", [TRI], { startsAtZero: true }),
  DOT_PLOT: kind("Dot plot", "COMPARISON", "BUILT", [LAT, SBP]),
  LINE: kind("Line", "TREND", "BUILT", [SBP, FIN], { legacyType: "LINE" }),
  STEP_LINE: kind("Step line", "TREND", "BUILT", [SBP, FIN]),
  AREA: kind("Area", "TREND", "BUILT", [SBP, FIN], { legacyType: "AREA", startsAtZero: true }),
  AREA_STACKED: kind("Stacked area", "TREND", "BUILT", [SBP], { additiveOnly: true, startsAtZero: true }),
  SPARKLINE: kind("Sparkline", "TREND", "BUILT", [SBP, FIN], { minPoints: 3 }),
  SLOPE: kind("Slope (first and last period)", "TREND", "BUILT", [SBP], { minPoints: 2 }),
  CALENDAR_HEATMAP: kind("Calendar heatmap", "TREND", "BUILT", [DAY], { additiveOnly: true, minPoints: 2 }),
  PIE: kind("Pie", "PART_TO_WHOLE", "BUILT", [LAT, STA, PLC], { legacyType: "PIE", additiveOnly: true }),
  DONUT: kind("Donut", "PART_TO_WHOLE", "BUILT", [LAT, STA, PLC], { additiveOnly: true }),
  TREEMAP: kind("Treemap", "PART_TO_WHOLE", "BUILT", [LAT, STA, PLC], { additiveOnly: true, minPoints: 3 }),
  SUNBURST: kind("Sunburst (by logframe level)", "PART_TO_WHOLE", "BUILT", [LAT], { additiveOnly: true, minPoints: 3 }),
  WAFFLE: kind("Waffle (100 squares)", "PART_TO_WHOLE", "BUILT", [LAT, STA], { additiveOnly: true, minPoints: 2 }),
  HISTOGRAM: kind("Histogram", "DISTRIBUTION", "BUILT", [SBP], { minPoints: 5 }),
  BOX_PLOT: kind("Box plot", "DISTRIBUTION", "BUILT", [SBP], { minPoints: 5 }),
  POPULATION_PYRAMID: kind("Population pyramid (age and sex)", "DISTRIBUTION", "PLANNED", [], { additiveOnly: true, minPoints: 2 }),
  SCATTER: kind("Scatter", "RELATIONSHIP", "BUILT", [SBP], { minPoints: 3 }),
  BUBBLE: kind("Bubble", "RELATIONSHIP", "BUILT", [SBP], { minPoints: 3 }),
  HEATMAP: kind("Heatmap", "MATRIX", "BUILT", [SBP], { minPoints: 4 }),
  FUNNEL: kind("Funnel", "FLOW", "BUILT", [LAT], { additiveOnly: true, minPoints: 2 }),
  WATERFALL: kind("Waterfall", "FLOW", "BUILT", [TRI, SBP], { additiveOnly: true, minPoints: 2 }),
  SANKEY: kind("Sankey", "FLOW", "BUILT", [BUD], { additiveOnly: true, minPoints: 2 }),
  GAUGE: kind("Gauge", "PROGRESS", "BUILT", [TRI], { legacyType: "GAUGE" }),
  PROGRESS_RING: kind("Progress ring", "PROGRESS", "BUILT", [TRI]),
  PROGRESS_BAR: kind("Progress bar", "PROGRESS", "BUILT", [TRI], { startsAtZero: true }),
  KPI_NUMBER: kind("Key figure", "PROGRESS", "BUILT", [TRI]),
  RADAR: kind("Radar", "PROGRESS", "BUILT", [LAT], { legacyType: "RADAR", minPoints: 3 }),
  GANTT: kind("Gantt", "SCHEDULE", "BUILT", [PLN], { minPoints: 1 }),
  CHOROPLETH: kind("Choropleth map", "GEOGRAPHIC", "BUILT", [PLC], { minPoints: 2 }),
  GRADUATED_SYMBOLS: kind("Graduated symbols map", "GEOGRAPHIC", "BUILT", [PLC], { additiveOnly: true, minPoints: 2 }),
  BAR_LINE_COMBO: kind("Bar and line", "COMBINATION", "BUILT", [SBP, FIN], { startsAtZero: true, minPoints: 1 }),
  PIVOT_TABLE: kind("Pivot table", "TABLE", "BUILT", [SBP, LAT, FIN]),
  SCORECARD_TABLE: kind("Scorecard table", "TABLE", "BUILT", [LAT]),
};

export const CHART_KIND_ORDER = Object.keys(CHART_KINDS) as ChartKind[];

export type ChartSplit = "NONE" | "GROUP" | "PLACE" | "PROJECT";
export type ChartSort = "NONE" | "ASC" | "DESC" | "LABEL";
export type AxisScale = "LINEAR" | "LOG";
export type LegendPosition = "TOP" | "BOTTOM" | "LEFT" | "RIGHT" | "HIDDEN";
export type LabelFormat = "VALUE" | "PERCENT" | "NAME" | "NAME_VALUE";
export type NumberFormat = "FULL" | "COMPACT" | "DECIMAL_1" | "DECIMAL_2";
export type ChartSize = "SQUARE" | "WIDE" | "TALL" | "A4_HALF" | "A4_FULL" | "SLIDE";
export type LineStyle = "SOLID" | "DASHED" | "DOTTED";

export const LEGEND_POSITIONS: readonly LegendPosition[] = ["TOP", "BOTTOM", "LEFT", "RIGHT", "HIDDEN"];
export const LABEL_FORMATS: readonly LabelFormat[] = ["VALUE", "PERCENT", "NAME", "NAME_VALUE"];
export const NUMBER_FORMATS: readonly NumberFormat[] = ["FULL", "COMPACT", "DECIMAL_1", "DECIMAL_2"];
export const CHART_SIZES: readonly ChartSize[] = ["SQUARE", "WIDE", "TALL", "A4_HALF", "A4_FULL", "SLIDE"];

export interface AxisSpec {
  title?: string | undefined;
  min?: number | undefined;
  max?: number | undefined;
  scale?: AxisScale | undefined;
  reversed?: boolean | undefined;
  gridlines?: boolean | undefined;
}

/** A per-series override, by position in the drawn series list. */
export interface SeriesStyle {
  index: number;
  label?: string | undefined;
  color?: string | undefined;
  /** Draw this series as another kind (a line over bars). */
  kind?: ChartKind | undefined;
  lineStyle?: LineStyle | undefined;
  showLabels?: boolean | undefined;
  hidden?: boolean | undefined;
  /** A second axis is allowed only when the spec names it (axes.y2.title carries its unit). */
  axis?: "PRIMARY" | "SECONDARY" | undefined;
}

export type ChartAnnotation =
  | { id: string; type: "LINE"; value: number; text?: string | undefined; color?: string | undefined }
  | { id: string; type: "BAND"; from: number; to: number; text?: string | undefined; color?: string | undefined }
  | { id: string; type: "NOTE"; text: string; color?: string | undefined };

export interface ChartDatasetQuery {
  /** The data shape the chart is drawn from (the v1 template: how many indicators, finance or status). */
  template: DataChartTemplate;
  indicatorIds: string[];
  measure: ChartMeasure;
  fromPeriodId?: string | undefined;
  toPeriodId?: string | undefined;
  showTarget: boolean;
  splitBy?: ChartSplit | undefined;
  sort?: ChartSort | undefined;
  /** Keep the largest N and group the rest as "Other". */
  topN?: number | undefined;
  /** RESULTS_BY_PLACE: how deep in the place tree to read (0 country, 1 first-level area, …). */
  placeLevel?: number | undefined;
  /** Draft values are plotted only when this is on (they are flagged either way). */
  includeDraft: boolean;
}

export interface ChartSpecV2 {
  version: 2;
  kind: ChartKind;
  dataset: ChartDatasetQuery;
  title?: string | undefined;
  subtitle?: string | undefined;
  caption?: string | undefined;
  series?: SeriesStyle[] | undefined;
  axes?: { x?: AxisSpec | undefined; y?: AxisSpec | undefined; y2?: AxisSpec | undefined } | undefined;
  legend?: { position: LegendPosition } | undefined;
  labels?: { show: boolean; format: LabelFormat; numberFormat?: NumberFormat | undefined } | undefined;
  annotations?: ChartAnnotation[] | undefined;
  /** A named palette (`CHART_PALETTES`) or explicit colours; explicit colours win. */
  paletteId?: string | undefined;
  colors?: string[] | undefined;
  size?: ChartSize | undefined;
  /** What the chart says, for a reader who cannot see it. */
  altText?: string | undefined;
}

export const MAX_CHART_ANNOTATIONS = 12;
export const MAX_TOP_N = 50;

const LEGACY_KIND: Record<ChartType, ChartKind> = { BAR: "BAR", LINE: "LINE", PIE: "PIE", AREA: "AREA", RADAR: "RADAR", GAUGE: "GAUGE" };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Reads a stored chart spec of any version as v2: v2 as it is, v1 lifted without losing a field. Anything else is null.
 * A v1 chart plotted drafts, so the lifted spec does too (`includeDraft: true`): nothing a person saw is hidden by migrating.
 */
export function migrateChartSpec(stored: unknown): ChartSpecV2 | null {
  if (!isRecord(stored)) return null;
  if (stored.version === 2) return isRecord(stored.dataset) && typeof stored.kind === "string" ? (stored as unknown as ChartSpecV2) : null;
  if (stored.version !== undefined) return null;
  const v1 = stored as unknown as DataChartSpec;
  if (typeof v1.template !== "string" || typeof v1.type !== "string") return null;
  const k = LEGACY_KIND[v1.type];
  if (!k) return null;
  return {
    version: 2,
    kind: k,
    dataset: {
      template: v1.template,
      indicatorIds: Array.isArray(v1.indicatorIds) ? [...v1.indicatorIds] : [],
      measure: v1.measure,
      ...(v1.fromPeriodId !== undefined ? { fromPeriodId: v1.fromPeriodId } : {}),
      ...(v1.toPeriodId !== undefined ? { toPeriodId: v1.toPeriodId } : {}),
      showTarget: Boolean(v1.showTarget),
      includeDraft: true,
    },
    ...(v1.title !== undefined ? { title: v1.title } : {}),
    ...(Array.isArray(v1.colors) && v1.colors.length > 0 ? { colors: [...v1.colors] } : {}),
  };
}

/** The v1 spec the existing renderer understands, or null when this kind is not drawn yet (or needs v2-only settings). */
export function toLegacySpec(spec: ChartSpecV2): DataChartSpec | null {
  const rule = CHART_KINDS[spec.kind];
  if (!rule || rule.status !== "BUILT" || !rule.legacyType) return null;
  // Only the original templates have a v1 form (the plan, activity days and budget are Chart Studio data).
  if (!LEGACY_TEMPLATES.has(spec.dataset.template)) return null;
  return {
    template: spec.dataset.template as LegacyDataChartTemplate,
    indicatorIds: [...spec.dataset.indicatorIds],
    measure: spec.dataset.measure,
    type: rule.legacyType,
    ...(spec.dataset.fromPeriodId !== undefined ? { fromPeriodId: spec.dataset.fromPeriodId } : {}),
    ...(spec.dataset.toPeriodId !== undefined ? { toPeriodId: spec.dataset.toPeriodId } : {}),
    showTarget: spec.dataset.showTarget,
    ...(spec.title !== undefined ? { title: spec.title } : {}),
    ...(spec.colors !== undefined ? { colors: [...spec.colors] } : {}),
  };
}

/** What the checker may know about an indicator (a rate is never stacked, sliced or summed). */
export interface ChartIndicatorFacts {
  id: string;
  isRate: boolean;
}

export type ChartProblemCode =
  | "NOT_A_SPEC" | "UNKNOWN_KIND" | "KIND_NOT_DRAWN_YET" | "UNKNOWN_TEMPLATE" | "KIND_NOT_FOR_TEMPLATE" | "INDICATOR_COUNT"
  | "UNKNOWN_MEASURE" | "RATE_NOT_ADDITIVE" | "AXIS_RANGE" | "BAR_AXIS_NOT_ZERO" | "LOG_NEEDS_POSITIVE" | "TOP_N_RANGE"
  | "COLOUR_FORMAT" | "TOO_MANY_ANNOTATIONS" | "ANNOTATION_INVALID" | "SECONDARY_AXIS_UNNAMED" | "TEXT_TOO_LONG" | "SERIES_KIND_UNKNOWN"
  | "UNKNOWN_SETTING";

export interface ChartProblem {
  code: ChartProblemCode;
  /** Where in the spec, as a dotted path (`axes.y.min`); the screen uses it to point at the control. */
  path: string;
  /** A plain sentence for the person; screens translate from `code` + `path`. */
  message: string;
}

export interface ValidateChartOptions {
  /** The studio previews kinds that are catalogued but not drawn yet; saving never allows it. */
  allowPlanned?: boolean;
  indicators?: ReadonlyArray<ChartIndicatorFacts>;
}

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** Everything wrong with a chart spec; an empty list means it can be saved and drawn. */
export function validateChartSpec(spec: unknown, options: ValidateChartOptions = {}): ChartProblem[] {
  const problems: ChartProblem[] = [];
  const add = (code: ChartProblemCode, path: string, message: string) => problems.push({ code, path, message });
  if (!isRecord(spec) || spec.version !== 2) {
    add("NOT_A_SPEC", "", "This is not a chart definition.");
    return problems;
  }
  const s = spec as unknown as ChartSpecV2;
  const rule = CHART_KINDS[s.kind];
  if (!rule) add("UNKNOWN_KIND", "kind", "This chart type is not offered.");
  else if (rule.status === "PLANNED" && !options.allowPlanned) add("KIND_NOT_DRAWN_YET", "kind", `${rule.label} charts are not available yet.`);

  const ds = s.dataset;
  const info = ds ? DATA_CHART_TEMPLATES[ds.template] : undefined;
  if (!info) add("UNKNOWN_TEMPLATE", "dataset.template", "The data this chart is drawn from is not known.");
  else {
    // A kind is drawn only from the data shapes it can honestly show (a funnel needs each indicator's latest value, not a time series).
    const shape = TEMPLATE_SHAPE[ds.template];
    if (rule?.status === "BUILT" && (!shape || !rule.shapes.includes(shape))) add("KIND_NOT_FOR_TEMPLATE", "kind", `${info.label} cannot be drawn as a ${rule.label.toLowerCase()} chart.`);
    const n = ds.indicatorIds?.length ?? 0;
    if (info.indicators === "one" && n !== 1) add("INDICATOR_COUNT", "dataset.indicatorIds", "Choose exactly one indicator for this chart.");
    if (info.indicators === "many" && n < 1) add("INDICATOR_COUNT", "dataset.indicatorIds", "Choose at least one indicator for this chart.");
    if (info.indicators === "none" && n !== 0) add("INDICATOR_COUNT", "dataset.indicatorIds", "This chart takes no indicators.");
  }
  if (ds && !CHART_MEASURES.includes(ds.measure)) add("UNKNOWN_MEASURE", "dataset.measure", "What to measure is not known.");
  if (ds?.topN !== undefined && !(Number.isInteger(ds.topN) && ds.topN >= 1 && ds.topN <= MAX_TOP_N)) add("TOP_N_RANGE", "dataset.topN", `Show between 1 and ${MAX_TOP_N} items.`);

  if (rule?.additiveOnly && options.indicators && ds) {
    const rates = ds.indicatorIds.filter((id) => options.indicators!.find((i) => i.id === id)?.isRate);
    if (rates.length > 0) add("RATE_NOT_ADDITIVE", "dataset.indicatorIds", `${rule.label} charts add values up, so they cannot show a rate (a percentage or ratio).`);
  }

  const checkAxis = (name: "x" | "y" | "y2", a: AxisSpec | undefined) => {
    if (!a) return;
    const base = `axes.${name}`;
    if (a.min !== undefined && !finite(a.min)) add("AXIS_RANGE", `${base}.min`, "The lowest value must be a number.");
    if (a.max !== undefined && !finite(a.max)) add("AXIS_RANGE", `${base}.max`, "The highest value must be a number.");
    if (finite(a.min) && finite(a.max) && a.min >= a.max) add("AXIS_RANGE", `${base}.min`, "The lowest value must be below the highest.");
    if (a.scale === "LOG" && !(finite(a.min) ? a.min > 0 : true)) add("LOG_NEEDS_POSITIVE", `${base}.min`, "A logarithmic axis cannot start at zero or below.");
    if (a.title !== undefined && a.title.length > 120) add("TEXT_TOO_LONG", `${base}.title`, "An axis title is at most 120 characters.");
  };
  checkAxis("x", s.axes?.x);
  checkAxis("y", s.axes?.y);
  checkAxis("y2", s.axes?.y2);
  if (rule?.startsAtZero && finite(s.axes?.y?.min) && s.axes!.y!.min! > 0) add("BAR_AXIS_NOT_ZERO", "axes.y.min", `A ${rule.label.toLowerCase()} chart always starts at zero; a cut axis makes small differences look large.`);

  for (const [i, st] of (s.series ?? []).entries()) {
    if (st.kind !== undefined && !CHART_KINDS[st.kind]) add("SERIES_KIND_UNKNOWN", `series.${i}.kind`, "This chart type is not offered.");
    if (st.color !== undefined && !HEX_COLOUR.test(st.color)) add("COLOUR_FORMAT", `series.${i}.color`, "A colour must be written as #rrggbb.");
    if (st.axis === "SECONDARY" && !s.axes?.y2?.title?.trim()) add("SECONDARY_AXIS_UNNAMED", `series.${i}.axis`, "A second axis needs a title that names its unit, so two units never share one axis unannounced.");
  }
  if ((s.colors ?? []).some((c) => !HEX_COLOUR.test(c))) add("COLOUR_FORMAT", "colors", "A colour must be written as #rrggbb.");

  const notes = s.annotations ?? [];
  if (notes.length > MAX_CHART_ANNOTATIONS) add("TOO_MANY_ANNOTATIONS", "annotations", `A chart carries at most ${MAX_CHART_ANNOTATIONS} notes and lines.`);
  const seen = new Set<string>();
  for (const [i, a] of notes.entries()) {
    const at = `annotations.${i}`;
    if (!a.id || seen.has(a.id)) add("ANNOTATION_INVALID", at, "Two notes share an id.");
    seen.add(a.id);
    if (a.type === "LINE" && !finite(a.value)) add("ANNOTATION_INVALID", `${at}.value`, "A reference line needs a number.");
    else if (a.type === "BAND" && !(finite(a.from) && finite(a.to) && a.from < a.to)) add("ANNOTATION_INVALID", at, "A shaded band needs a start below its end.");
    else if (a.type === "NOTE" && !a.text?.trim()) add("ANNOTATION_INVALID", `${at}.text`, "A note needs some text.");
    else if (a.type !== "LINE" && a.type !== "BAND" && a.type !== "NOTE") add("ANNOTATION_INVALID", at, "This kind of note is not known.");
    if (a.text !== undefined && a.text.length > 200) add("TEXT_TOO_LONG", `${at}.text`, "A note is at most 200 characters.");
    if (a.color !== undefined && !HEX_COLOUR.test(a.color)) add("COLOUR_FORMAT", `${at}.color`, "A colour must be written as #rrggbb.");
  }

  if (s.title !== undefined && s.title.length > 200) add("TEXT_TOO_LONG", "title", "A chart's title is at most 200 characters.");
  if (s.subtitle !== undefined && s.subtitle.length > 200) add("TEXT_TOO_LONG", "subtitle", "A subtitle is at most 200 characters.");
  if (s.caption !== undefined && s.caption.length > 400) add("TEXT_TOO_LONG", "caption", "A caption is at most 400 characters.");
  if (s.altText !== undefined && s.altText.length > 500) add("TEXT_TOO_LONG", "altText", "The text description is at most 500 characters.");
  if (s.legend && !LEGEND_POSITIONS.includes(s.legend.position)) add("UNKNOWN_SETTING", "legend.position", "This legend position is not known.");
  if (s.labels && !LABEL_FORMATS.includes(s.labels.format)) add("UNKNOWN_SETTING", "labels.format", "This label format is not known.");
  if (s.labels?.numberFormat !== undefined && !NUMBER_FORMATS.includes(s.labels.numberFormat)) add("UNKNOWN_SETTING", "labels.numberFormat", "This number format is not known.");
  if (s.size !== undefined && !CHART_SIZES.includes(s.size)) add("UNKNOWN_SETTING", "size", "This chart size is not known.");
  return problems;
}

/** The kinds a template's data can be drawn as: the BUILT kinds whose data shapes include the template's shape. */
export function kindsForTemplate(template: DataChartTemplate): ChartKind[] {
  const shape = TEMPLATE_SHAPE[template];
  if (!shape) return [];
  return CHART_KIND_ORDER.filter((k) => CHART_KINDS[k].status === "BUILT" && CHART_KINDS[k].shapes.includes(shape));
}

/** Kinds grouped by family, in catalogue order, for the studio's kind picker. */
export function kindsByFamily(): Array<{ family: ChartFamily; kinds: ChartKind[] }> {
  const out = new Map<ChartFamily, ChartKind[]>();
  for (const k of CHART_KIND_ORDER) {
    const f = CHART_KINDS[k].family;
    out.set(f, [...(out.get(f) ?? []), k]);
  }
  return [...out].map(([family, kinds]) => ({ family, kinds }));
}
