/**
 * Number tiles (Phase 35): the big coloured cards of a management dashboard — "Obligated $11.8 thousand USD", "Activities 14". One table
 * says what each metric is; `computeMetric` turns the data a tile was given into the figure to show. Pure: no clock, no server.
 *
 * Honesty: a figure nobody recorded is shown as "not recorded", never 0; money is never added across currencies (a figure in the
 * reporting currency appears only when every amount has a dated rate, otherwise the tile says "Rate needed"); activity counts come
 * from the same status counts the status donut uses, so a tile and a chart cannot disagree.
 */
import type { DatasetPlanRow } from "../reporting/dataset-query.js";
import { planCounts } from "../reporting/plan-counts.js";
import type { Amount } from "../finance/money.js";
import type { FinanceIndex } from "../finance/project-finance.js";

export const TILE_COLORS = ["ORANGE", "GREEN", "GREY", "PURPLE", "BLUE", "RED"] as const;
export type TileColor = (typeof TILE_COLORS)[number];

export type MetricKey =
  | "FIN_OBLIGATED" | "FIN_RECEIVED" | "FIN_SPENT" | "FIN_REMAINING"
  | "ACTIVITIES_TOTAL" | "ACTIVITIES_IN_PROGRESS" | "ACTIVITIES_DONE" | "ACTIVITIES_LATE";

export interface MetricInfo { label: string; group: "FINANCE" | "ACTIVITIES"; defaultColor: TileColor }

/** The one table of metrics (exhaustive by type): what a person chooses from and what the tile is called. */
export const METRICS: Readonly<Record<MetricKey, MetricInfo>> = {
  FIN_OBLIGATED: { label: "Obligated", group: "FINANCE", defaultColor: "GREEN" },
  FIN_RECEIVED: { label: "Received", group: "FINANCE", defaultColor: "GREY" },
  FIN_SPENT: { label: "Spent", group: "FINANCE", defaultColor: "ORANGE" },
  FIN_REMAINING: { label: "Still to receive", group: "FINANCE", defaultColor: "BLUE" },
  ACTIVITIES_TOTAL: { label: "Activities", group: "ACTIVITIES", defaultColor: "PURPLE" },
  ACTIVITIES_IN_PROGRESS: { label: "In progress", group: "ACTIVITIES", defaultColor: "BLUE" },
  ACTIVITIES_DONE: { label: "Done", group: "ACTIVITIES", defaultColor: "GREEN" },
  ACTIVITIES_LATE: { label: "Late", group: "ACTIVITIES", defaultColor: "RED" },
};
export const METRIC_KEYS = Object.keys(METRICS) as MetricKey[];

export interface MetricQuery {
  metric: MetricKey;
  color?: TileColor | undefined;
  /** Finance only: the currency to read; absent = the reporting currency. */
  currency?: string | undefined;
  /** A name for the tile; absent = the metric's own. */
  title?: string | undefined;
}

export interface ConvertedFigure { total: Amount | null; needsRate: ReadonlyArray<unknown> }
export interface MetricFinanceFigures {
  primaryCurrency: string;
  index: FinanceIndex;
  inPrimary: { obligated: ConvertedFigure; disbursed: ConvertedFigure; spent: ConvertedFigure };
}

export interface MetricInputs { plan?: ReadonlyArray<DatasetPlanRow> | undefined; finance?: MetricFinanceFigures | undefined }

export interface MetricTile {
  title: string;
  color: TileColor;
  /** null = nothing to show (see `note`). */
  value: number | null;
  /** The figure as shown: "91.1", "14". Empty when there is no value. */
  text: string;
  /** What the figure is measured in: "thousand USD", "activities". */
  unit: string;
  note: string | null;
}

/** Money in major units to a short figure and its magnitude word: 91100 -> { text: "91.1", scale: "thousand" }. Under a thousand the full amount is shown. */
export function scaleMoney(major: number): { text: string; scale: string } {
  const abs = Math.abs(major);
  const pick = (div: number, scale: string) => ({ text: String(Math.round((major / div) * 10) / 10), scale });
  if (abs >= 1e9) return pick(1e9, "billion");
  if (abs >= 1e6) return pick(1e6, "million");
  if (abs >= 1e3) return pick(1e3, "thousand");
  return { text: String(Math.round(major * 100) / 100), scale: "" };
}

const none = (title: string, color: TileColor, note: string, unit = ""): MetricTile => ({ title, color, value: null, text: "", unit, note });

function financeValue(metric: MetricKey, want: string, f: MetricFinanceFigures): { value: number | null; note: string | null } {
  const list = metric === "FIN_OBLIGATED" ? f.index.obligated : metric === "FIN_RECEIVED" ? f.index.disbursed : metric === "FIN_SPENT" ? f.index.spent : f.index.remaining;
  const total = metric === "FIN_OBLIGATED" ? f.inPrimary.obligated : metric === "FIN_RECEIVED" ? f.inPrimary.disbursed : metric === "FIN_SPENT" ? f.inPrimary.spent : null;
  const ownCurrency = list.find((m) => m.currency === want);
  const otherCurrencies = list.some((m) => m.currency !== want);
  if (want === f.primaryCurrency && otherCurrencies) {
    if (total) return total.total ? { value: total.total.minor / 100, note: null } : { value: null, note: "Rate needed" };
    // "Still to receive" in the reporting currency is obligated minus received, each converted; only when both could be.
    const o = f.inPrimary.obligated.total, d = f.inPrimary.disbursed.total;
    return o && d ? { value: (o.minor - d.minor) / 100, note: null } : { value: null, note: "Rate needed" };
  }
  if (ownCurrency) return { value: ownCurrency.minor / 100, note: null };
  return { value: null, note: list.length > 0 ? `None in ${want}` : "Not recorded yet" };
}

export function computeMetric(query: MetricQuery, input: MetricInputs): MetricTile {
  const info = METRICS[query.metric];
  const color = query.color ?? info.defaultColor;
  const title = query.title?.trim() || info.label;
  if (info.group === "ACTIVITIES") {
    if (!input.plan) return none(title, color, "Not available here");
    if (input.plan.filter((r) => r.kind === "ACTIVITY").length === 0) return none(title, color, "No plan yet", "activities");
    const c = planCounts(input.plan);
    const value = query.metric === "ACTIVITIES_TOTAL" ? c.total : query.metric === "ACTIVITIES_IN_PROGRESS" ? c.inProgress : query.metric === "ACTIVITIES_DONE" ? c.done : c.late;
    return { title, color, value, text: String(value), unit: value === 1 ? "activity" : "activities", note: null };
  }
  if (!input.finance) return none(title, color, "Not available here");
  const want = (query.currency ?? input.finance.primaryCurrency).toUpperCase();
  const r = financeValue(query.metric, want, input.finance);
  if (r.value === null) return none(title, color, r.note ?? "Not recorded yet", want);
  const s = scaleMoney(r.value);
  return { title, color, value: r.value, text: s.text, unit: `${s.scale ? `${s.scale} ` : ""}${want}`, note: null };
}

export function validateMetricQuery(q: MetricQuery): string | null {
  if (!(q.metric in METRICS)) return "That figure is not one a tile can show.";
  if (q.color !== undefined && !TILE_COLORS.includes(q.color)) return "That colour is not available.";
  if (q.currency !== undefined && !/^[A-Za-z]{3}$/.test(q.currency)) return "Use a three-letter currency code, such as USD.";
  if (q.currency !== undefined && METRICS[q.metric].group !== "FINANCE") return "Only a money figure has a currency.";
  if (q.title !== undefined && q.title.length > 60) return "A tile's name is at most 60 characters.";
  return null;
}
