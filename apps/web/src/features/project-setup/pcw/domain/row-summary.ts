import type { IndicatorRow } from "./results-view.ts";
import type { PlanRow } from "./plan-view.ts";

/** What a closed wizard row can still be missing, as codes; the screen turns each into a word in the person's language. */
export type IndicatorGap = "result" | "type" | "baseline" | "target" | "frequency" | "owner" | "direction";
export type PlanGap = "activity" | "dates" | "place" | "lead";

export interface RowSummary<G extends string> {
  /** Short facts shown after the title, in order, empty ones left out (never a placeholder or 0). */
  facts: string[];
  gaps: G[];
}

const has = (v: string | null | undefined): boolean => (v ?? "").trim() !== "";

/** An indicator's one-line summary and what it still needs (the same things the slide's requirements ask for). */
export function indicatorSummary(row: IndicatorRow): RowSummary<IndicatorGap> {
  const { value, ownerKey, direction, baselineNone } = row;
  const gaps: IndicatorGap[] = [];
  if (!has(value.logframeCode)) gaps.push("result");
  if (!has(value.type)) gaps.push("type");
  if (!baselineNone && !has(value.baseline)) gaps.push("baseline");
  if (!has(value.target)) gaps.push("target");
  if (!has(value.frequency)) gaps.push("frequency");
  if (!has(ownerKey)) gaps.push("owner");
  if (!has(direction)) gaps.push("direction");
  const facts = [value.type, value.target ? `→ ${value.target}${value.unit ? ` ${value.unit}` : ""}` : null, value.frequency].filter((f): f is string => has(f));
  return { facts, gaps };
}

/** A planned activity's one-line summary and what it still needs (dates, a place or "project-wide", a lead). */
export function planSummary(row: PlanRow): RowSummary<PlanGap> {
  const { item, setup } = row;
  const v = item.value;
  const gaps: PlanGap[] = [];
  if (!has(v.logframeCode)) gaps.push("activity");
  if (!has(v.start) || !has(v.end)) gaps.push("dates");
  if (!setup.projectWide && setup.placeNames.length === 0) gaps.push("place");
  if (!has(setup.leadKey)) gaps.push("lead");
  const dates = has(v.start) && has(v.end) ? `${v.start} → ${v.end}` : has(v.start) ? String(v.start) : null;
  const facts = [dates].filter((f): f is string => has(f));
  return { facts, gaps };
}
