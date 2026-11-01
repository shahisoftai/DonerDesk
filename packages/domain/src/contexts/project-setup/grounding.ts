/**
 * Grounding (Phase 36): the deterministic check every proposed item must pass before a person is shown it. The quote must
 * appear verbatim in the document (whitespace-normalised), every figure in the value must appear in the quote in one spelling
 * ("1,200" = "1200.0"), and every date in the value must be a date the quote states — "1 March 2026" in a quote grounds the
 * ISO "2026-03-01". An item that fails is dropped and counted, never shown. A value a person edited is their own and skips
 * the check. Pure; the same figure normaliser as Ask (`askFigures`) is reused so the one-spelling rule cannot drift.
 */
import { askFigures } from "../ask/ask.js";
import { isPlainDate, type PlainDate } from "../workplan/plain-date.js";
import { normaliseForMatch } from "./source-document.js";
import { SETUP_AREAS, type SetupAreaKey } from "./proposal-areas.js";
import type { Proposed, SetupConfidence } from "./proposal.js";

export type GroundingFailure = "QUOTE_NOT_FOUND" | "FIGURE_NOT_IN_QUOTE" | "DATE_NOT_IN_QUOTE";

export type GroundingOutcome = { grounded: true; confidence: "HIGH" } | { grounded: false; reason: GroundingFailure };

const MONTHS: Record<string, number> = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4, may: 5,
  june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8, september: 9, sept: 9, sep: 9,
  october: 10, oct: 10, november: 11, nov: 11, december: 12, dec: 12,
};

const ISO_DATE = /(\d{4})-(\d{2})-(\d{2})/g;
const DAY_MONTH_YEAR = /(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})/g;
const MONTH_DAY_YEAR = /([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/g;
const NUMERIC_DATE = /(\d{1,2})[/](\d{1,2})[/](\d{4})/g;

const iso = (year: number, month: number, day: number): PlainDate | undefined => {
  const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return isPlainDate(date) && day >= 1 && day <= 31 ? date : undefined;
};

/**
 * Every date a text states, as plain ISO days. Month-name forms ("12 March 2026", "March 12, 2026") and numeric d/m/yyyy
 * forms are read only when they are unambiguous (a day above 12 decides); an ambiguous "3/4/2026" is never matched — a
 * date the check cannot pin down is a date the proposal must not claim.
 */
export function datesInText(text: string): PlainDate[] {
  const found = new Set<PlainDate>();
  for (const m of text.matchAll(ISO_DATE)) {
    const date = iso(Number(m[1]), Number(m[2]), Number(m[3]));
    if (date) found.add(date);
  }
  for (const m of text.matchAll(DAY_MONTH_YEAR)) {
    const month = MONTHS[m[2]!.toLowerCase()];
    const date = month ? iso(Number(m[3]), month, Number(m[1])) : undefined;
    if (date) found.add(date);
  }
  for (const m of text.matchAll(MONTH_DAY_YEAR)) {
    const month = MONTHS[m[1]!.toLowerCase()];
    const date = month ? iso(Number(m[3]), month, Number(m[2])) : undefined;
    if (date) found.add(date);
  }
  for (const m of text.matchAll(NUMERIC_DATE)) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const year = Number(m[3]);
    // Only unambiguous: a day above 12 decides which number is the day; otherwise neither reading is taken.
    const date = a > 12 ? iso(year, b, a) : b > 12 ? iso(year, a, b) : undefined;
    if (date) found.add(date);
  }
  return [...found];
}

/** The figures of a value text, with full ISO dates removed first (their parts are not figures of their own). */
function valueFigures(raw: string): { figures: string[]; dates: PlainDate[] } {
  const dates: PlainDate[] = [];
  const stripped = raw.replace(/(\d{4})-(\d{2})-(\d{2})/g, (match, y: string, m: string, d: string) => {
    const date = iso(Number(y), Number(m), Number(d));
    if (!date) return match;
    dates.push(date);
    return " ";
  });
  const figures = askFigures(stripped.replace(/-/g, " "));
  return { figures, dates: [...new Set(dates)] };
}

/**
 * Fields that point at another item or classify this one rather than state a figure: a parent's code read from the
 * numbering, the logframe item an indicator or activity serves, a place's admin level. `checkProposal` checks the links
 * against the proposal itself; requiring them in the item's own quote would drop every correctly linked item.
 */
export const NON_FIGURE_FIELDS: readonly string[] = ["parentCode", "logframeCode", "adminLevel", "group", "planCode", "linkSource", "kind", "ref"];

function withoutLinks(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value ?? "";
  // A code the domain made (G1, OC1.2) is not the document's figure: only a code the document gave must be in its quote.
  const generated = (value as Record<string, unknown>).codeSource === "GENERATED";
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([k]) => !NON_FIGURE_FIELDS.includes(k) && !(generated && k === "code")));
}

/**
 * Checks one proposed item against the document text. The quote must be verbatim, and every figure and date the value states
 * must be in the quote. Grounding alone certifies HIGH; a model's own lower self-rating is combined afterwards with
 * `lowerConfidence`, never discarded.
 */
export function groundProposed<T>(item: Proposed<T>, sourceText: string): GroundingOutcome {
  if (item.status === "EDITED") return { grounded: true, confidence: "HIGH" };
  const quote = item.sourceQuote;
  if (!quote || !normaliseForMatch(sourceText).includes(normaliseForMatch(quote))) {
    return { grounded: false, reason: "QUOTE_NOT_FOUND" };
  }
  const raw = typeof item.value === "string" ? item.value : JSON.stringify(withoutLinks(item.value));
  const { figures, dates } = valueFigures(raw);
  const quoteFigures = new Set(askFigures(quote));
  if (figures.some((f) => !quoteFigures.has(f))) return { grounded: false, reason: "FIGURE_NOT_IN_QUOTE" };
  if (dates.length > 0) {
    const quoteDates = new Set(datesInText(quote));
    if (dates.some((d) => !quoteDates.has(d))) return { grounded: false, reason: "DATE_NOT_IN_QUOTE" };
  }
  return { grounded: true, confidence: "HIGH" };
}

const CONFIDENCE_ORDER: readonly SetupConfidence[] = ["LOW", "MEDIUM", "HIGH"];

/** The cautious one of two confidence readings: grounding and the model's self-rating both count, the lower wins. */
export function lowerConfidence(a: SetupConfidence, b: SetupConfidence): SetupConfidence {
  return CONFIDENCE_ORDER.indexOf(a) <= CONFIDENCE_ORDER.indexOf(b) ? a : b;
}

const isProposedNode = (x: unknown): x is Proposed<unknown> =>
  typeof x === "object" && x !== null && "value" in x && "status" in x && "sourceQuote" in x && "confidence" in x &&
  typeof (x as { status?: unknown }).status === "string";

const DROPPED = Symbol("dropped");

const NOT_STATED_ITEM = (): Proposed<unknown> => ({ value: null, sourceQuote: null, sourceRef: null, confidence: "LOW", status: "PROPOSED" });

export interface GroundedAreaPatch {
  /** The same keys, with every ungrounded item removed. */
  fields: Record<string, unknown>;
  /** Items the check looked at, and how many were dropped before anyone saw them. */
  checked: number;
  dropped: number;
  /** What was left out and why (at most `LEFT_OUT_LIMIT`), so the review can show it instead of dropping it silently. */
  leftOut: LeftOutItem[];
}

export interface LeftOutItem {
  /** The proposal field the item was read for ("logframe", "facts.countries"). */
  field: string;
  /** The words the item claimed to be read from (cut to 200 characters), or its title when it had no quote. */
  text: string;
  reason: GroundingFailure;
}

export const LEFT_OUT_LIMIT = 40;

const describeItem = (item: Proposed<unknown>): string => {
  const value = item.value as Record<string, unknown> | string | null;
  const title = typeof value === "string" ? value : value && typeof value === "object" ? (value.title ?? value.name ?? value.category ?? value.sourceName) : null;
  return String(item.sourceQuote ?? title ?? "").slice(0, 200);
};

/**
 * Grounds every proposed item in one area's extracted patch against the document text and removes the ones that fail, so an
 * ungrounded item is never shown to a person or stored. The patch's keys must be proposal fields the area owns (its row in
 * `SETUP_AREAS`); anything else is refused rather than merged. Pure.
 */
export function groundAreaPatch(
  area: SetupAreaKey,
  fields: Readonly<Record<string, unknown>>,
  sourceText: string,
): GroundedAreaPatch | { error: string } {
  const def = SETUP_AREAS[area];
  const outside = Object.keys(fields).filter((k) => !def.fields.includes(k));
  if (outside.length > 0) {
    return { error: `The ${def.labelKey} extraction returned fields it does not own (${outside.join(", ")}).` };
  }
  const counts = { checked: 0, dropped: 0 };
  const leftOut: LeftOutItem[] = [];
  const ground = (value: unknown, field: string): unknown => {
    if (Array.isArray(value)) {
      return value.map((v) => ground(v, field)).filter((v) => v !== DROPPED);
    }
    if (isProposedNode(value)) {
      if (value.value === null || value.value === undefined) return value;
      counts.checked += 1;
      const outcome = groundProposed(value, sourceText);
      if (!outcome.grounded) {
        counts.dropped += 1;
        if (leftOut.length < LEFT_OUT_LIMIT) leftOut.push({ field, text: describeItem(value), reason: outcome.reason });
        return DROPPED;
      }
      // A second reading is held to the same rule as the first: one that is not in the documents is simply not offered.
      if (value.alternatives) {
        const alternatives = value.alternatives.filter((a) => groundProposed({ ...a, confidence: "HIGH", status: "PROPOSED" }, sourceText).grounded);
        const { alternatives: _dropped, ...rest } = value;
        return alternatives.length > 0 ? { ...rest, alternatives } : rest;
      }
      return value;
    }
    if (value && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        const next = ground(v, `${field}.${k}`);
        // A named field (a fact) is never removed: an ungrounded one becomes "Not stated", so the record keeps its shape.
        out[k] = next === DROPPED ? NOT_STATED_ITEM() : next;
      }
      return out;
    }
    return value;
  };
  return {
    fields: Object.fromEntries(Object.keys(fields).map((k) => [k, ground(fields[k], k)])),
    checked: counts.checked,
    dropped: counts.dropped,
    leftOut,
  };
}
