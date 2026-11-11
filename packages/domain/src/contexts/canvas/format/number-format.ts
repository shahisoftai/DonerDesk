/**
 * Writing a figure the way a block's `numbers` format asks (Phase 50.2). A gap is never written as 0: `null` comes back as `null`
 * and the screen writes its own "Not reported". Digits stay Latin in every language (the product rule since Phase 32).
 */
import type { DisplayUnit, NumbersFormat } from "./types.js";

const UNIT_SIZE: Record<Exclude<DisplayUnit, "AUTO" | "NONE">, number> = { K: 1e3, M: 1e6, B: 1e9 };

/** The unit AUTO picks: none under ten thousand, then K, M, B. */
export function autoUnit(value: number): Exclude<DisplayUnit, "AUTO"> {
  const a = Math.abs(value);
  return a >= 1e9 ? "B" : a >= 1e6 ? "M" : a >= 1e4 ? "K" : "NONE";
}

export function formatFigure(value: number | null, format: NumbersFormat = {}, locale = "en"): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  const unit = (format.units ?? "AUTO") === "AUTO" ? autoUnit(value) : (format.units as Exclude<DisplayUnit, "AUTO">);
  const scaled = unit === "NONE" ? value : value / UNIT_SIZE[unit];
  const decimals = format.decimals ?? (unit === "NONE" ? (Number.isInteger(scaled) ? 0 : 1) : 1);
  const body = new Intl.NumberFormat(locale === "ar" ? "ar-u-nu-latn" : locale, { minimumFractionDigits: unit === "NONE" ? 0 : 0, maximumFractionDigits: decimals, useGrouping: format.separators ?? true }).format(Math.abs(scaled));
  const withUnit = `${format.prefix ?? ""}${body}${unit === "NONE" ? "" : unit}${format.suffix ?? ""}`;
  if (scaled >= 0 || Object.is(scaled, 0)) return withUnit;
  return (format.negative ?? "minus") === "parentheses" ? `(${withUnit})` : `-${withUnit}`;
}

export function numbersProblems(f: NumbersFormat): string[] {
  const out: string[] = [];
  if (f.decimals !== undefined && (!Number.isInteger(f.decimals) || f.decimals < 0 || f.decimals > 4)) out.push("Decimals are 0 to 4.");
  if ((f.prefix?.length ?? 0) > 6 || (f.suffix?.length ?? 0) > 12) out.push("A prefix is at most 6 characters and a suffix at most 12.");
  return out;
}
