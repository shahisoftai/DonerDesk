/**
 * Whether a recorded value meets a reference standard (Phase 46.5). A standard is a reference, not a target: the verdict is shown
 * beside the target and never replaces the target's stoplight. It judges only a number the person actually recorded for a kind
 * of indicator that can be compared, and says why when it will not judge. Pure.
 */
import type { ReferenceStandard } from "./model.js";

export type ReferenceVerdict =
  | { state: "MEETS" | "BELOW" | "ABOVE" }
  | { state: "NOT_JUDGED"; reason: "NO_VALUE" | "NOT_NUMBER" | "UNIT_DIFFERS" | "NO_STANDARD" };

const toNumber = (v: string | number | null | undefined): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const cleaned = v.replace(/[,\s%]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

/**
 * `MEETS` when the figure satisfies the standard's comparator, otherwise `BELOW` or `ABOVE` the required level. A missing value is
 * never read as 0. `unit` is the unit the person's indicator is recorded in; a different unit is not compared.
 */
export function referenceVerdict(standard: ReferenceStandard | null | undefined, value: string | number | null | undefined, unit?: string | null): ReferenceVerdict {
  if (!standard) return { state: "NOT_JUDGED", reason: "NO_STANDARD" };
  if (value === null || value === undefined || (typeof value === "string" && !value.trim())) return { state: "NOT_JUDGED", reason: "NO_VALUE" };
  const n = toNumber(value);
  if (n === null) return { state: "NOT_JUDGED", reason: "NOT_NUMBER" };
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  if (unit && standard.unit && !same(unit, standard.unit)) return { state: "NOT_JUDGED", reason: "UNIT_DIFFERS" };
  switch (standard.comparator) {
    case "GTE": return { state: n >= (standard.value as number) ? "MEETS" : "BELOW" };
    case "LTE": return { state: n <= (standard.value as number) ? "MEETS" : "ABOVE" };
    case "EQ": return { state: n === (standard.value as number) ? "MEETS" : n < (standard.value as number) ? "BELOW" : "ABOVE" };
    case "BETWEEN": return { state: n < (standard.min as number) ? "BELOW" : n > (standard.max as number) ? "ABOVE" : "MEETS" };
  }
}

/** The standard as a short phrase for a screen: "at least 15 l/p/d", "at most 20 people per toilet", "5–15 %". */
export function describeStandard(s: ReferenceStandard): string {
  switch (s.comparator) {
    case "GTE": return `at least ${s.value} ${s.unit}`;
    case "LTE": return `at most ${s.value} ${s.unit}`;
    case "EQ": return `exactly ${s.value} ${s.unit}`;
    case "BETWEEN": return `${s.min} to ${s.max} ${s.unit}`;
  }
}
