/**
 * A card of several figures (Phase 50.3): the Power BI "new card" with reference labels, and the province panel of a coordination
 * dashboard. Each item is an indicator's figure, a count, or a money/activity tile figure; `resolveMultiCard` reads them all from data
 * already gathered (one sheet, one set of counts), so a repeater of cards over places reads once.
 *
 * Honesty: a figure nobody recorded is `null` with a reason, never 0; an indicator's figure for one place comes only from what was
 * recorded for that place (its LOCATION breakdown) and only for the period value (no invented cumulative by place); drafts are left
 * out unless the card asks for them, and then counted.
 */
import type { DataSheet, DataSheetCell } from "../reporting/data-sheet.js";
import { normalizeLocationKey } from "../workplan/location-key.js";
import { COUNT_METRICS, computeCount, validateCountQuery, type CountFacts, type CountMetricKey } from "./count-metrics.js";
import { METRICS, computeMetric, validateMetricQuery, type MetricInputs, type MetricKey } from "./metric-tile.js";

export const MULTI_CARD_MAX_ITEMS = 12;
export const MULTI_CARD_LAYOUTS = ["GRID", "ROW", "COLUMN"] as const;

export type CardSource =
  | { kind: "INDICATOR"; indicatorId: string; measure: "PERIOD" | "CUMULATIVE" }
  | { kind: "COUNT"; metric: CountMetricKey; level?: number | undefined; facilityType?: string | undefined }
  | { kind: "TILE"; metric: MetricKey };

export interface CardItem { source: CardSource; label?: string | undefined }
export interface MultiCardProps {
  items: CardItem[];
  layout: (typeof MULTI_CARD_LAYOUTS)[number];
  columns: number;
  includeDraft: boolean;
  /** A heading inside the card ("Punjab"); in a repeater the repeated place's name is used when this is empty. */
  header?: string | undefined;
}

export interface MultiCardInputs { sheet?: DataSheet | undefined; counts?: CountFacts | undefined; metrics?: MetricInputs | undefined; place?: { key: string; name: string } | undefined }
export interface CardFigure { label: string; value: number | null; unit: string; reason: string | null; unverified: boolean }
export interface MultiCardModel { header: string | null; layout: MultiCardProps["layout"]; columns: number; items: CardFigure[]; unverifiedCount: number }

const num = (s: string | undefined): number | null => { if (s === undefined || s.trim() === "") return null; const n = Number(s.replace(/,/g, "")); return Number.isFinite(n) ? n : null; };
const sourceKey = (s: CardSource): string => JSON.stringify(s);

function indicatorFigure(src: Extract<CardSource, { kind: "INDICATOR" }>, input: MultiCardInputs, includeDraft: boolean): Omit<CardFigure, "label"> & { label: string } {
  const sheet = input.sheet;
  if (!sheet) return { label: "", value: null, unit: "", reason: "The figures are read when this is opened.", unverified: false };
  const ind = sheet.indicators.find((i) => i.id === src.indicatorId);
  if (!ind) return { label: "", value: null, unit: "", reason: "That indicator is not in this project.", unverified: false };
  const order = new Map(sheet.periods.map((p, i) => [p.id, i] as const));
  const cells = sheet.cells.filter((c) => c.indicatorId === ind.id && !c.notApplicable && (includeDraft || c.status === "VERIFIED")).sort((a, b) => (order.get(b.periodId) ?? 0) - (order.get(a.periodId) ?? 0));
  const unit = ind.unit ?? "";
  if (input.place) {
    if (src.measure === "CUMULATIVE") return { label: ind.name, value: null, unit, reason: "A total to date is not recorded by place.", unverified: false };
    const want = normalizeLocationKey(input.place.key);
    const at = (c: DataSheetCell) => c.breakdown?.find((b) => b.dimension.trim().toUpperCase() === "LOCATION" && normalizeLocationKey(b.category) === want);
    const cell = cells.find((c) => at(c) && num(at(c)!.value) !== null);
    return cell ? { label: ind.name, value: num(at(cell)!.value), unit, reason: null, unverified: cell.status !== "VERIFIED" } : { label: ind.name, value: null, unit, reason: "Not reported", unverified: false };
  }
  const pick = (c: DataSheetCell) => num(src.measure === "CUMULATIVE" ? c.cumulativeValue : c.periodValue);
  const cell = cells.find((c) => pick(c) !== null);
  return cell ? { label: ind.name, value: pick(cell), unit, reason: null, unverified: cell.status !== "VERIFIED" } : { label: ind.name, value: null, unit, reason: "Not reported", unverified: false };
}

export function resolveMultiCard(props: MultiCardProps, input: MultiCardInputs): MultiCardModel {
  const list = Array.isArray(props?.items) ? props.items.filter((i): i is CardItem => typeof i === "object" && i !== null) : [];
  const items = list.map((item): CardFigure => {
    const s = (typeof item.source === "object" && item.source !== null ? item.source : { kind: "NONE" }) as CardSource | { kind: "NONE" };
    let f: CardFigure;
    if (s.kind === "COUNT" && !(s.metric in COUNT_METRICS) || s.kind === "TILE" && !(s.metric in METRICS) || !["INDICATOR", "COUNT", "TILE"].includes(s.kind)) f = { label: "", value: null, unit: "", reason: "Choose what this figure shows.", unverified: false };
    else if (s.kind === "INDICATOR") f = indicatorFigure(s, input, props.includeDraft === true);
    else if (s.kind === "COUNT") {
      if (!input.counts) f = { label: COUNT_METRICS[s.metric].label, value: null, unit: COUNT_METRICS[s.metric].unit, reason: "Not available here", unverified: false };
      else { const c = computeCount({ metric: s.metric, level: s.level, facilityType: s.facilityType, placeKey: input.place?.key }, input.counts); f = { label: COUNT_METRICS[s.metric].label, value: c.value, unit: c.unit, reason: c.note, unverified: false }; }
    } else if (s.kind !== "TILE") f = { label: "", value: null, unit: "", reason: "Choose what this figure shows.", unverified: false };
    else if (input.place) f = { label: METRICS[s.metric].label, value: null, unit: "", reason: "Not shown by place.", unverified: false };
    else { const t = computeMetric({ metric: s.metric }, input.metrics ?? {}); f = { label: t.title, value: t.value, unit: t.unit, reason: t.note, unverified: false }; }
    return { ...f, label: (typeof item.label === "string" ? item.label.trim() : "") || f.label };
  });
  const layout = MULTI_CARD_LAYOUTS.includes(props?.layout) ? props.layout : "GRID";
  const columns = Number.isInteger(props?.columns) && props.columns >= 1 && props.columns <= 4 ? props.columns : 3;
  return { header: (typeof props?.header === "string" ? props.header.trim() : "") || input.place?.name || null, layout, columns, items, unverifiedCount: items.filter((i) => i.unverified).length };
}

export function multiCardProblems(p: MultiCardProps): string[] {
  const out: string[] = [];
  if (!Array.isArray(p.items) || p.items.length === 0) return ["Add at least one figure."];
  if (p.items.length > MULTI_CARD_MAX_ITEMS) out.push(`A card shows at most ${MULTI_CARD_MAX_ITEMS} figures.`);
  if (!MULTI_CARD_LAYOUTS.includes(p.layout)) out.push("Unknown layout.");
  if (!Number.isInteger(p.columns) || p.columns < 1 || p.columns > 4) out.push("A card has 1 to 4 columns.");
  if ((p.header?.length ?? 0) > 60) out.push("A card heading is at most 60 characters.");
  const seen = new Set<string>();
  for (const it of p.items) {
    const k = sourceKey(it.source);
    if (seen.has(k)) out.push("The same figure is in the card twice.");
    seen.add(k);
    if ((it.label?.length ?? 0) > 40) out.push("A figure's label is at most 40 characters.");
    const s = it.source;
    if (s.kind === "INDICATOR") { if (!s.indicatorId) out.push("Choose an indicator for each figure."); if (s.measure !== "PERIOD" && s.measure !== "CUMULATIVE") out.push("Show the period value or the total to date."); }
    else if (s.kind === "COUNT") { const m = validateCountQuery({ metric: s.metric, level: s.level, facilityType: s.facilityType }); if (m) out.push(m); }
    else if (s.kind === "TILE") { const m = validateMetricQuery({ metric: s.metric }); if (m) out.push(m); }
    else out.push("Unknown figure.");
  }
  return [...new Set(out)];
}
