/**
 * The project facts an infographic-style block reads (Phase 45.1): the same figures the Studio's data read holds, as a plain
 * structure the application layer fills (`ProjectInfographicDataDto` satisfies it). Helpers here are the one place a figure is
 * picked from them, so a missing value is handled the same way in every block: absent, never 0; a rate never gets a percent of target.
 */
import { hasShareOfTarget, type DataSheet, type DataSheetFinanceRow, type DataSheetIndicator } from "../reporting/data-sheet.js";
import { parseFigure } from "../infographics/grounding.js";
import type { ActivitiesByLocation, IndicatorLocationView, LocationTargetActualView, UniqueReach } from "../reporting/location-analytics.js";

export interface FactsIndicator { id: string; code: string; name: string; location: IndicatorLocationView; targetActual: LocationTargetActualView }

export type PortfolioBand = "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "NO_PLAN";
export interface PortfolioFactsRow { title: string; donorName: string; country: string; band: string; nextReport?: { deadline: string; daysUntil: number } | undefined }
export interface PortfolioFactsCountry { country: string; projects: number; onTrack: number; atRisk: number; offTrack: number; noPlan: number }
/** The portfolio read a portfolio block draws from: every project the person can see, reduced to what a page needs (nothing is combined into a score). */
export interface PortfolioFacts {
  asAt?: string | undefined;
  rows: PortfolioFactsRow[];
  countries?: PortfolioFactsCountry[] | undefined;
  totals: { projects: number; countries: number; behind: number; needAttention: number; openRisks: number; reportsOverdue: number; onTrack?: number | undefined; noPlan?: number | undefined };
}

import type { CountFacts } from "../dashboards/count-metrics.js";

export interface CanvasFacts {
  sheet: DataSheet;
  /** The design's own period range (absent = every period). */
  range?: { fromId?: string | undefined; toId?: string | undefined } | undefined;
  /** The design's default place filter. */
  locationKeys?: string[] | undefined;
  reach: UniqueReach & { registeredTotal: number; bySex: Record<string, number>; byAgeGroup: Record<string, number> };
  activities: ActivitiesByLocation;
  finance: { enabled: boolean; rows: DataSheetFinanceRow[] };
  indicators: FactsIndicator[];
  /** The design's acknowledgement line (a banner with no words of its own shows it). */
  acknowledgement?: string | undefined;
  /** The project the figures belong to, for a cover. */
  project?: { title: string; donorName: string; country: string } | undefined;
  /** The design's own title and subtitle, and its cover picture. */
  designTitle?: string | undefined;
  subtitle?: string | undefined;
  coverAssetId?: string | undefined;
  /** Portfolio totals, for portfolio designs; absent for a single project. */
  portfolio?: PortfolioFacts | undefined;
  /** Counts a card may show (places reached, donors, partners, facilities, Phase 50.3); absent when they could not be read for this viewer. */
  counts?: CountFacts | undefined;
  /** The display name of the one place a repeater item or a filter narrows to. */
  placeName?: string | undefined;
}

export function designPeriods(f: Pick<CanvasFacts, "sheet" | "range">): string[] {
  const order = f.sheet.periods.map((p) => p.id);
  const from = f.range?.fromId ? order.indexOf(f.range.fromId) : 0;
  const to = f.range?.toId ? order.indexOf(f.range.toId) : order.length - 1;
  if (from < 0 || to < 0) return order;
  return order.slice(Math.min(from, to), Math.max(from, to) + 1);
}

export interface LatestValue {
  id: string; code: string; name: string; level: string | null; unit?: string; isRate: boolean;
  value: string; number: number | null; target: string; targetNumber: number | null;
  /** Percent of target; null for a rate, a lower-is-better indicator, no target or no value. */
  percent: number | null;
  verified: boolean; periodId: string;
}

export function latestFor(f: Pick<CanvasFacts, "sheet" | "range">, indicator: DataSheetIndicator): LatestValue | undefined {
  const periods = designPeriods(f);
  for (let i = periods.length - 1; i >= 0; i -= 1) {
    const periodId = periods[i] as string;
    const cell = f.sheet.cells.find((x) => x.indicatorId === indicator.id && x.periodId === periodId);
    if (!cell) continue;
    const value = !indicator.isRate && cell.cumulativeValue.trim() !== "" ? cell.cumulativeValue : cell.periodValue;
    if (value.trim() === "") continue;
    const number = parseFigure(value);
    const targetNumber = parseFigure(indicator.target);
    const percent = hasShareOfTarget(indicator) && number !== null && targetNumber !== null && targetNumber > 0 ? (number / targetNumber) * 100 : null;
    return { id: indicator.id, code: indicator.code, name: indicator.name, level: indicator.level, ...(indicator.unit ? { unit: indicator.unit } : {}), isRate: indicator.isRate, value, number, target: indicator.target, targetNumber, percent, verified: cell.status === "VERIFIED", periodId };
  }
  return undefined;
}

export function latestById(f: Pick<CanvasFacts, "sheet" | "range">, id: string): LatestValue | undefined {
  const indicator = f.sheet.indicators.find((i) => i.id === id);
  return indicator ? latestFor(f, indicator) : undefined;
}

/** The indicators a block shows: the ones it names, else the first `limit` that have a recorded value (and, when asked, a share of target). */
export function chosenIndicators(f: Pick<CanvasFacts, "sheet" | "range">, ids: readonly string[] | undefined, limit: number, onlyWithTarget = false): LatestValue[] {
  const out: LatestValue[] = [];
  if (ids?.length) {
    for (const id of ids) { const found = latestById(f, id); if (found) out.push(found); if (out.length >= limit) break; }
    return out;
  }
  for (const indicator of f.sheet.indicators) {
    const found = latestFor(f, indicator);
    if (!found || (onlyWithTarget && found.percent === null)) continue;
    out.push(found);
    if (out.length >= limit) break;
  }
  return out;
}

/** The finance row that speaks for the range: the latest verified one; only when none is verified does an unverified row show (and say so). */
export function latestFinance(f: Pick<CanvasFacts, "finance" | "sheet" | "range">): DataSheetFinanceRow | undefined {
  if (!f.finance.enabled || f.finance.rows.length === 0) return undefined;
  const periods = new Set(designPeriods(f));
  const inRange = f.finance.rows.filter((row) => periods.has(row.periodId));
  const pool = inRange.length > 0 ? inRange : f.finance.rows;
  return [...pool].reverse().find((row) => row.verified) ?? pool[pool.length - 1];
}

export type SexKind = "FEMALE" | "MALE" | "OTHER" | "UNKNOWN";
/** Which group a recorded sex key means; a key it does not know is `null` and shown as typed. */
export function sexKind(key: string): SexKind | null {
  const k = key.toLowerCase();
  if (["female", "f", "women", "girls"].includes(k)) return "FEMALE";
  if (["male", "m", "men", "boys"].includes(k)) return "MALE";
  if (k === "other" || k === "non-binary") return "OTHER";
  if (["unknown", "not stated", "unspecified"].includes(k)) return "UNKNOWN";
  return null;
}

export type AgeGroupKind = { kind: "UNDER_5" } | { kind: "60_PLUS" } | { kind: "RANGE"; from: number; to: number } | { kind: "OPEN"; from: number } | { kind: "UNKNOWN" } | { kind: "OTHER"; text: string };
/** A reader-facing meaning for an age-group key ("AGE_5_17" is 5 to 17); a key it does not know is tidied, never shown raw. */
export function ageGroupKind(key: string): AgeGroupKind {
  const k = key.toUpperCase();
  if (k === "UNDER_5") return { kind: "UNDER_5" };
  if (k === "AGE_60_PLUS") return { kind: "60_PLUS" };
  const range = /^AGE_(\d+)_(\d+)$/.exec(k) ?? /^(\d+)\s*-\s*(\d+)$/.exec(key);
  if (range) return { kind: "RANGE", from: Number(range[1]), to: Number(range[2]) };
  const open = /^(\d+)\+$/.exec(key);
  if (open) return { kind: "OPEN", from: Number(open[1]) };
  if (/unknown|not.?stated/i.test(key)) return { kind: "UNKNOWN" };
  return { kind: "OTHER", text: key.replace(/^AGE_/i, "").replace(/_/g, " ").toLowerCase().replace(/^\w/, (ch) => ch.toUpperCase()) };
}

/** Age-group keys in reading order: by the first number they contain, "unknown" last. */
export function sortedAgeGroups(entries: Array<[string, number]>): Array<[string, number]> {
  const rank = (key: string): number => {
    if (/^UNDER/i.test(key)) return -1;
    const m = /\d+/.exec(key);
    if (m) return Number(m[0]);
    return /unknown|not/i.test(key) ? 1e6 : 5e5;
  };
  return [...entries].sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]));
}

/** Facts for a block that reads only the portfolio: no project, so the project parts are empty and a block that asks for them says so. */
export function portfolioOnlyFacts(portfolio: PortfolioFacts): CanvasFacts {
  return {
    sheet: { projectId: "", periods: [], indicators: [], cells: [], finance: [] },
    reach: { overallUnique: 0, registeredTotal: 0, registeredByLocation: [], attendancesByActivityLocation: [], beneficiariesWithoutLocation: 0, attendancesWithoutLocation: 0, bySex: {}, byAgeGroup: {} },
    activities: { rows: [], unlocated: 0 }, finance: { enabled: false, rows: [] }, indicators: [], portfolio,
  };
}
