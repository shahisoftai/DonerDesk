/**
 * Facts read more than once (Phase 37.4). When two passages give a fact different values, the first stays the proposal and
 * the others are kept beside it as alternatives (at most `MAX_ALTERNATIVES`), each with its own quote — the person chooses,
 * nothing is decided by guess. The work plan's span is offered for the project's dates the same way, from the activities'
 * own rows. Countries are written with the list's names (`recogniseCountry`); a word the list does not know is kept as
 * written and flagged. Pure.
 */
import { compareDates, isPlainDate } from "../workplan/plain-date.js";
import { recogniseCountry } from "./country-names.js";
import type { Alternative, ProjectSetupProposal, Proposed, ProposedFacts } from "./proposal.js";

export const MAX_ALTERNATIVES = 3;

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** `item` with `other` kept as an alternative when it says something different (and has a quote). */
export function withAlternative<T>(item: Proposed<T>, other: Proposed<T> | Alternative<T> | undefined): Proposed<T> {
  if (!other || other.value === null || other.value === undefined || !other.sourceQuote) return item;
  if (item.value === null) return { ...item, value: other.value, sourceQuote: other.sourceQuote, sourceRef: other.sourceRef };
  const known = [item.value, ...(item.alternatives ?? []).map((a) => a.value)];
  if (known.some((v) => same(v, other.value)) || (item.alternatives?.length ?? 0) >= MAX_ALTERNATIVES) return item;
  return { ...item, alternatives: [...(item.alternatives ?? []), { value: other.value, sourceQuote: other.sourceQuote, sourceRef: other.sourceRef }] };
}

/** Each written country in the list's own name; the others as written. */
export const countryNames = (values: ReadonlyArray<string>): string[] => [...new Set(values.map((v) => recogniseCountry(v) ?? v.trim()))];

/** The work plan's first start and last end, each with the row that states it, offered for the project's dates. */
export function offerPlanDates(proposal: ProjectSetupProposal): ProjectSetupProposal {
  const rows = proposal.plan.filter((a) => a.status !== "REJECTED" && a.value && a.sourceQuote);
  const dated = (key: "start" | "end") => rows.filter((a) => a.value![key] && isPlainDate(a.value![key]!));
  const first = dated("start").sort((a, b) => compareDates(a.value!.start!, b.value!.start!))[0];
  const last = dated("end").sort((a, b) => compareDates(b.value!.end!, a.value!.end!))[0];
  if (!first && !last) return proposal;
  const facts: ProposedFacts = { ...proposal.facts };
  const offer = (field: "startDate" | "endDate", row: typeof first, date: string | null | undefined) => {
    const item = facts[field];
    if (!row || !date || item.status === "EDITED" || item.status === "REJECTED") return;
    // An empty date is not filled from the plan: it is offered, and the person decides.
    const holder: Proposed<string> = item.value === null ? { ...item, value: null } : item;
    const alternative = { value: date, sourceQuote: row.sourceQuote!, sourceRef: row.sourceRef };
    facts[field] = item.value === null ? { ...holder, alternatives: dedupe([...(holder.alternatives ?? []), alternative]) } : withAlternative(holder, alternative);
  };
  offer("startDate", first, first?.value?.start);
  offer("endDate", last, last?.value?.end);
  return { ...proposal, facts };
}

const dedupe = <T>(list: Alternative<T>[]): Alternative<T>[] => list.filter((a, i) => list.findIndex((b) => same(a.value, b.value)) === i).slice(0, MAX_ALTERNATIVES);
