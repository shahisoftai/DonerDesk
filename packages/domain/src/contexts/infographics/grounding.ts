/**
 * Figures a written sentence may state (Phase 32.8): the rule that keeps model-written infographic text honest. A sentence may
 * contain a number only if the records give that number (exactly, rounded the way a headline is rounded, or as a percent of a
 * target). Years are allowed; everything else is refused. Pure: the facts come in, a verdict goes out.
 */
import type { StoryFacts } from "./suggest.js";

/** Every number the facts justify, including the roundings a person might choose. */
export function allowedFigures(facts: StoryFacts): Set<number> {
  const out = new Set<number>();
  const add = (n: number | null | undefined): void => {
    if (n === null || n === undefined || !Number.isFinite(n)) return;
    out.add(n);
    out.add(Math.round(n));
    out.add(Math.round(n * 10) / 10);
    out.add(Math.floor(n));
    if (Math.abs(n) >= 100) out.add(Math.round(n / 100) * 100);
    if (Math.abs(n) >= 1000) {
      out.add(Math.round(n / 1000) * 1000);
      out.add(Math.round(n / 100) / 10 * 1000); // 21.3 thousand
      out.add(Math.round((n / 1000) * 10) / 10); // "21.3" in "21.3 thousand"
      out.add(Math.round(n / 1000)); // "21" in "21 thousand"
    }
    if (Math.abs(n) >= 1_000_000) {
      out.add(Math.round((n / 1_000_000) * 10) / 10);
      out.add(Math.round(n / 1_000_000));
    }
  };
  add(facts.reachUnique);
  add(facts.activitiesDone);
  add(facts.activitiesPlanned);
  add(facts.locations.length);
  add(facts.locations.length > 0 ? facts.locations.length : null);
  for (const indicator of facts.indicators) {
    add(parseFigure(indicator.value));
    add(parseFigure(indicator.target));
    add(indicator.percentOfTarget);
  }
  return out;
}

/** A recorded value such as "1,250", "62.5" or "64%" as a number; null when it is not one. */
export function parseFigure(value: string | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[,\s  ]/g, "").replace(/%$/, "");
  return /^-?\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : null;
}

/**
 * The numbers a text states, read the way people write them in the offered languages: "21,345", "21 345", "21.345" (a group of
 * three after a separator is a thousands group), "71.6", "71,6" (a short group after a separator is a decimal), "64%".
 */
export function numbersIn(text: string): number[] {
  const out: number[] = [];
  const pattern = /\d+(?:[   ,.]\d+)*/g;
  for (const match of text.matchAll(pattern)) {
    const raw = match[0];
    const parts = raw.split(/[   ,.]/);
    // Groups of exactly three digits after the first part are thousands groups; anything else ends the integer part.
    let integer = parts[0] ?? "";
    let i = 1;
    while (i < parts.length && (parts[i] ?? "").length === 3 && (parts[0] ?? "").length <= 3) integer += parts[i++];
    // A first part longer than three digits followed by a separator cannot be a grouped number: read the rest as a decimal.
    const decimals = i < parts.length ? parts.slice(i).join("") : "";
    const value = Number(decimals ? `${integer}.${decimals}` : integer);
    if (Number.isFinite(value)) out.push(value);
    // "1 234 567" style: the loop above grouped the first thousands group only; a long run of groups is read whole.
    if (parts.length > 2 && parts.slice(1).every((p) => p.length === 3) && (parts[0] ?? "").length <= 3) {
      out.pop();
      out.push(Number(parts.join("")));
    }
  }
  return out;
}

const isYear = (n: number): boolean => Number.isInteger(n) && n >= 1950 && n <= 2100;

/** The numbers in a sentence that the facts do not justify (years are not counted). Empty = every figure is grounded. */
export function ungroundedNumbers(text: string, allowed: ReadonlySet<number>): number[] {
  return numbersIn(text).filter((n) => !isYear(n) && !allowed.has(n) && !allowed.has(Math.round(n)) && !allowed.has(Math.round(n * 10) / 10));
}
