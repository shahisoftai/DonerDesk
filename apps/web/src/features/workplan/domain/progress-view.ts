/** Plain words and totals for the progress log on a planned activity (phase 28.1). Pure, so it is unit-tested. */
export const PROGRESS_KIND_WORDS: Readonly<Record<string, string>> = { DAILY: "Day", WEEKLY: "Week", MONTHLY: "Month", END: "Whole activity" };

export interface ViewEntry {
  id: string;
  kind: string;
  from: string;
  to: string;
  values: { total: number | null };
  absorbedById: string | null;
}

/**
 * The people reached so far: the sum of the live daily, weekly and monthly entries. An entry absorbed by a monthly report is
 * not added again. Nothing recorded is "not recorded yet", never zero.
 */
export function reachedSoFar(entries: ReadonlyArray<ViewEntry>): number | null {
  const live = entries.filter((e) => e.kind !== "END" && e.absorbedById === null && e.values.total !== null);
  return live.length ? live.reduce((sum, e) => sum + (e.values.total ?? 0), 0) : null;
}

/** "12 to 18 Oct" style range for an entry, from its stored ISO dates. */
export function entryRange(e: Pick<ViewEntry, "from" | "to">): string {
  return e.from === e.to ? e.from : `${e.from} to ${e.to}`;
}
