/**
 * What an officer's location text means as a grouping key (Phase 31): "Gulu", "Gulu District" and
 * "gulu" are one place. The one normalizer for every location string in the product — indicator
 * breakdown categories, activity locations, beneficiary locations and the site map — so roll-ups
 * across records and periods always agree. Pure: no clock, no geo data, no I/O.
 *
 * A key is never shown to a person; the display name stays exactly what was typed (see
 * `locationGroup`), and a place the normalizer cannot fold is still a key — nothing is dropped.
 */

/** The words an officer appends to a place name that carry no place identity ("Gulu District" is "Gulu"). */
export const ADMIN_SUFFIXES: readonly string[] = [
  "district",
  "sub county",
  "sub-county",
  "county",
  "municipality",
  "municipal",
  "province",
  "division",
  "region",
  "state",
  "city",
  "town",
  "village",
  "ward",
];

/** Folded, punctuation-free, admin suffixes stripped: the key every place name is grouped by. */
export function normalizeLocationKey(value: string): string {
  let out = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  let stripped = true;
  while (stripped) {
    stripped = false;
    for (const suffix of ADMIN_SUFFIXES) {
      if (out.endsWith(` ${suffix}`)) {
        out = out.slice(0, out.length - suffix.length - 1).trim();
        stripped = true;
      }
    }
  }
  return out;
}

/** One row in, one group out: the display spelling stays what was typed; the key is for grouping only. */
export interface LocationNamed {
  location: string;
}

export interface LocationGroup {
  /** The canonical key — stable, folded, never displayed. */
  key: string;
  /** The most frequent original spelling among the members (first wins a tie). */
  display: string;
  /** How many members carry this key. */
  count: number;
}

/**
 * Groups named records by their location key. The display name is the most frequent original
 * spelling (ties go to the first seen), so grouping never rewrites what anyone typed. Records with
 * a blank location are left out — a missing location is a missing group, never "unknown".
 */
export function locationGroup<T extends LocationNamed>(records: readonly T[]): Array<{ group: LocationGroup; members: T[] }> {
  const buckets = new Map<string, { spellings: Map<string, number>; members: T[] }>();
  for (const record of records) {
    const raw = record.location?.trim() ?? "";
    if (!raw) continue;
    const key = normalizeLocationKey(raw);
    if (!key) continue;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { spellings: new Map(), members: [] };
      buckets.set(key, bucket);
    }
    bucket.spellings.set(raw, (bucket.spellings.get(raw) ?? 0) + 1);
    bucket.members.push(record);
  }
  return [...buckets.entries()].map(([key, bucket]) => {
    let display = "";
    let best = -1;
    for (const [spelling, count] of bucket.spellings) {
      if (count > best) {
        best = count;
        display = spelling;
      }
    }
    return { group: { key, display, count: bucket.members.length }, members: bucket.members };
  });
}
