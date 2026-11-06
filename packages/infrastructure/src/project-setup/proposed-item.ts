/**
 * How one item of a model reply becomes a `Proposed<T>` (Phase 36.2). The model answers each item with its fields plus
 * `quote`, `block` and `confidence`; these helpers read them defensively: an absent or malformed field is `null` ("Not
 * stated"), never a guess, and a confidence the model did not give is LOW. Grounding runs afterwards in the orchestrator.
 */
import { isPlainDate, type PlainDate, type Proposed, type SetupConfidence, type SourceRef } from "@donordesk/domain";
import type { ChunkContext } from "./extractor-shared.js";

export type RawItem = Record<string, unknown>;

const QUOTE_LIMIT = 400;
const CONFIDENCES: readonly SetupConfidence[] = ["HIGH", "MEDIUM", "LOW"];

export const asObject = (x: unknown): RawItem | null => (x && typeof x === "object" && !Array.isArray(x) ? (x as RawItem) : null);

export const asList = (x: unknown): RawItem[] => (Array.isArray(x) ? x.map(asObject).filter((i): i is RawItem => i !== null) : []);

/** A trimmed non-empty string, or null. Numbers are kept as the document wrote them. */
export function text(x: unknown): string | null {
  if (typeof x === "number" && Number.isFinite(x)) return String(x);
  if (typeof x !== "string") return null;
  const t = x.trim();
  return t === "" || /^(null|n\/a|not stated|none)$/i.test(t) ? null : t;
}

/** A plain ISO day, only when the model gave a whole valid one. */
export function plainDate(x: unknown): PlainDate | null {
  const t = text(x);
  return t && isPlainDate(t) ? t : null;
}

export function number(x: unknown): number | null {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  const t = text(x);
  if (t === null) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function strings(x: unknown): string[] | null {
  if (!Array.isArray(x)) return null;
  const list = x.map(text).filter((s): s is string => s !== null);
  return list.length > 0 ? list : null;
}

/** One of the allowed words (upper-cased), or null. */
export function oneOf<T extends string>(x: unknown, allowed: readonly T[]): T | null {
  const t = text(x)?.toUpperCase();
  return t && (allowed as readonly string[]).includes(t) ? (t as T) : null;
}

function sourceRef(block: unknown, ctx: ChunkContext): SourceRef | null {
  const index = number(block);
  const found = index === null ? undefined : ctx.blocks.find((b) => b.index === index);
  if (!found) return null;
  return { documentId: found.documentId, block: found.index, ...(found.page !== undefined ? { page: found.page } : {}) };
}

/** Wraps a value the model read with its quote, place and self-rated confidence; an all-null value is "Not stated". */
export function proposedFrom<T>(raw: RawItem, value: T | null, ctx: ChunkContext): Proposed<T> {
  const quote = text(raw.quote);
  const empty = value === null || (typeof value === "object" && value !== null && Object.values(value).every((v) => v === null));
  return {
    value: empty ? null : value,
    sourceQuote: empty || !quote ? null : quote.slice(0, QUOTE_LIMIT),
    sourceRef: empty ? null : sourceRef(raw.block, ctx),
    confidence: oneOf(raw.confidence, CONFIDENCES) ?? "LOW",
    status: "PROPOSED",
  };
}

export const notStated = <T>(): Proposed<T> => ({ value: null, sourceQuote: null, sourceRef: null, confidence: "LOW", status: "PROPOSED" });

/** Drops list items the model filled with nothing at all. */
export const stated = <T>(items: ReadonlyArray<Proposed<T>>): Proposed<T>[] => items.filter((i) => i.value !== null);
