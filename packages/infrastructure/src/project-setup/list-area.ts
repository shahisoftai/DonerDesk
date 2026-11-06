/**
 * The parse step every list-shaped area shares (Phase 36.2): `{ "<key>": [ item, ... ] }` from the model becomes the
 * proposal field of `Proposed<T>` items, each read by the area's own item reader. Items with nothing stated are dropped.
 */
import { asList, asObject, proposedFrom, stated, type RawItem } from "./proposed-item.js";
import type { ChunkContext, ChunkParser } from "./extractor-shared.js";

export type ItemReader<T> = (raw: RawItem) => T;

/** Reads several lists at once (`funding` and `budget` come from one reply); each reply key maps to one proposal field. */
export function parseLists(readers: Readonly<Record<string, ItemReader<unknown>>>): ChunkParser {
  return (raw: unknown, ctx: ChunkContext) => {
    const root = asObject(raw);
    if (!root) return "The model's answer was not an object.";
    const out: Record<string, unknown> = {};
    for (const [field, read] of Object.entries(readers)) {
      out[field] = stated(asList(root[field]).map((item) => proposedFrom(item, read(item), ctx)));
    }
    return out;
  };
}

/** A key that identifies the same item across chunks: its own fields, lower-cased. */
export const valueKey = (...keys: ReadonlyArray<string>) => (item: Record<string, unknown>): string => {
  const value = (item.value ?? {}) as Record<string, unknown>;
  return keys.map((k) => String(value[k] ?? "").toLowerCase().trim()).join("|");
};
