/**
 * The same item read from two documents (Phase 38 fix): a proposal's indicator table and a separate indicator sheet both held
 * the same 18 rows, so the review listed 36 and a person removed half by hand. Only a REPEAT is dropped — every value it states
 * is stated the same way by an item already kept, ignoring spacing and capitals — and the first one read stays (a sheet is read before the model's reading of
 * a narrative). Two items with the same code but a different title, target or date, or one that states more than the first, are both kept: a person must choose, nothing
 * is merged or guessed. Pure.
 */
import type { ProjectSetupProposal, Proposed } from "./proposal.js";

const LISTS = ["logframe", "indicators", "periods", "plan", "places", "funding", "budget", "risks"] as const;

const norm = (v: unknown): unknown => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().toLowerCase() : v);
const same = (a: unknown, b: unknown): boolean => JSON.stringify(norm(a)) === JSON.stringify(norm(b));

/** Every value `later` states is stated the same way by `kept` (a value `later` leaves empty says nothing). */
const repeats = (later: Record<string, unknown>, kept: Record<string, unknown>): boolean =>
  Object.entries(later).every(([k, v]) => v === null || v === undefined || v === "" || same(v, kept[k]));

export function dropExactDuplicates(proposal: ProjectSetupProposal): { proposal: ProjectSetupProposal; dropped: number } {
  let dropped = 0;
  const next: Record<string, unknown> = { ...proposal };
  for (const key of LISTS) {
    const kept: Proposed<unknown>[] = [];
    for (const item of proposal[key] as Proposed<unknown>[]) {
      const value = item.value;
      const isRepeat = value !== null && typeof value === "object"
        && kept.some((k) => k.value !== null && typeof k.value === "object" && repeats(value as Record<string, unknown>, k.value as Record<string, unknown>));
      if (isRepeat) { dropped += 1; continue; }
      kept.push(item);
    }
    next[key] = kept;
  }
  return { proposal: next as unknown as ProjectSetupProposal, dropped };
}
