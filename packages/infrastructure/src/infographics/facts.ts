/**
 * Reading figures for blocks (Phase 32): one place that turns the Data Center sheet and the
 * enriched project read into "the latest value of an indicator", "the finance row", etc. Blocks
 * never parse sheet cells themselves, so a missing value is handled the same way everywhere:
 * absent, never zero; a rate never gets a percent of target.
 */
import { hasShareOfTarget, type DataSheetIndicator } from "@donordesk/domain";
import { parseFigure, type RenderCtx } from "./kit.js";

export interface LatestValue {
  id: string;
  code: string;
  name: string;
  level: string | null;
  unit?: string;
  isRate: boolean;
  value: string;
  number: number | null;
  target: string;
  targetNumber: number | null;
  /** Percent of target; null for a rate, a lower-is-better indicator, no target or no value. */
  percent: number | null;
  verified: boolean;
  periodId: string;
}

/** The periods a design covers, in order (its own range, else all). */
export function periodsInRange(c: RenderCtx): string[] {
  const order = c.sheet.periods.map((p) => p.id);
  const from = c.config.periodFromId ? order.indexOf(c.config.periodFromId) : 0;
  const to = c.config.periodToId ? order.indexOf(c.config.periodToId) : order.length - 1;
  if (from < 0 || to < 0) return order;
  return order.slice(Math.min(from, to), Math.max(from, to) + 1);
}

export function latestFor(c: RenderCtx, indicator: DataSheetIndicator): LatestValue | undefined {
  const periods = periodsInRange(c);
  for (let i = periods.length - 1; i >= 0; i -= 1) {
    const periodId = periods[i] as string;
    const cell = c.sheet.cells.find((x) => x.indicatorId === indicator.id && x.periodId === periodId);
    if (!cell) continue;
    const useCumulative = !indicator.isRate && cell.cumulativeValue.trim() !== "";
    const value = useCumulative ? cell.cumulativeValue : cell.periodValue;
    if (value.trim() === "") continue;
    const number = parseFigure(value);
    const targetNumber = parseFigure(indicator.target);
    const share = hasShareOfTarget(indicator) && number !== null && targetNumber !== null && targetNumber > 0 ? (number / targetNumber) * 100 : null;
    return {
      id: indicator.id,
      code: indicator.code,
      name: indicator.name,
      level: indicator.level,
      ...(indicator.unit ? { unit: indicator.unit } : {}),
      isRate: indicator.isRate,
      value,
      number,
      target: indicator.target,
      targetNumber,
      percent: share,
      verified: cell.status === "VERIFIED",
      periodId,
    };
  }
  return undefined;
}

export function latestById(c: RenderCtx, id: string): LatestValue | undefined {
  const indicator = c.sheet.indicators.find((i) => i.id === id);
  return indicator ? latestFor(c, indicator) : undefined;
}

/** The indicators a block shows: the ones it names, else the first `limit` that have a recorded value. */
export function chosenIndicators(c: RenderCtx, ids: readonly string[] | undefined, limit: number, onlyWithTarget = false): LatestValue[] {
  const out: LatestValue[] = [];
  if (ids?.length) {
    for (const id of ids) {
      const found = latestById(c, id);
      if (found) out.push(found);
      if (out.length >= limit) break;
    }
    return out;
  }
  for (const indicator of c.sheet.indicators) {
    const found = latestFor(c, indicator);
    if (!found) continue;
    if (onlyWithTarget && found.percent === null) continue;
    out.push(found);
    if (out.length >= limit) break;
  }
  return out;
}

/** The latest finance row in range, when verified finance exists for this project. */
export function latestFinance(c: RenderCtx): { currency: string; budget: string; expenditure: string; balance: string; burnRatePercent?: string; verified: boolean } | undefined {
  if (!c.data.finance.enabled || c.data.finance.rows.length === 0) return undefined;
  const periods = new Set(periodsInRange(c));
  const rows = c.data.finance.rows.filter((row) => periods.has(row.periodId));
  const pool = rows.length > 0 ? rows : c.data.finance.rows;
  // The latest verified row speaks for "verified" figures; only when nothing is verified yet does an unverified row show (and say so).
  return [...pool].reverse().find((row) => row.verified) ?? pool[pool.length - 1];
}

export const sexLabel = (c: RenderCtx, key: string): string => {
  const k = key.toLowerCase();
  if (k === "female" || k === "f" || k === "women" || k === "girls") return c.l.female;
  if (k === "male" || k === "m" || k === "men" || k === "boys") return c.l.male;
  if (k === "other" || k === "non-binary") return c.l.other;
  if (k === "unknown" || k === "not stated" || k === "unspecified") return c.l.unknown;
  return key;
};

/** A reader-facing name for an age-group key ("AGE_5_17" is "5–17"); a key it does not know is tidied, never shown raw. */
export const ageLabel = (c: RenderCtx, key: string): string => {
  const k = key.toUpperCase();
  if (k === "UNDER_5") return c.l.ageUnder5;
  if (k === "AGE_60_PLUS") return c.l.age60Plus;
  const range = /^AGE_(\d+)_(\d+)$/.exec(k);
  if (range) return `${range[1]}–${range[2]}`;
  if (/^\d+\s*-\s*\d+$/.test(key) || /^\d+\+$/.test(key)) return key.replace(/\s*-\s*/, "–");
  if (/unknown|not.?stated/i.test(key)) return c.l.unknown;
  return key.replace(/^AGE_/i, "").replace(/_/g, " ").toLowerCase().replace(/^\w/, (ch) => ch.toUpperCase());
};

/** Age group keys in reading order: by the first number they contain, "unknown" last. */
export function sortedAgeGroups(entries: Array<[string, number]>): Array<[string, number]> {
  const rank = (key: string): number => {
    if (/^UNDER/i.test(key)) return -1;
    const m = /\d+/.exec(key);
    if (m) return Number(m[0]);
    return /unknown|not/i.test(key) ? 1e6 : 5e5;
  };
  return [...entries].sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]));
}
