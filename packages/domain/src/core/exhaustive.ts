/**
 * Exhaustive tables are how this codebase is extended (open/closed): a new kind is a new row, never a new branch.
 * This checks a table against the full list of keys it must cover, so a test fails the moment a kind is added
 * without its row (missing) or a row outlives its kind (extra).
 */
export interface ExhaustivenessGap {
  missing: string[];
  extra: string[];
}

export function exhaustivenessGap(table: Readonly<Record<string, unknown>>, keys: ReadonlyArray<string>): ExhaustivenessGap {
  const present = new Set(Object.keys(table));
  const wanted = new Set(keys);
  return {
    missing: keys.filter((k) => !present.has(k)),
    extra: [...present].filter((k) => !wanted.has(k)),
  };
}

export function assertExhaustive(table: Readonly<Record<string, unknown>>, keys: ReadonlyArray<string>, name = "table"): void {
  const gap = exhaustivenessGap(table, keys);
  if (gap.missing.length || gap.extra.length) {
    throw new Error(`${name} is not exhaustive: missing [${gap.missing.join(", ")}], extra [${gap.extra.join(", ")}]`);
  }
}
