/**
 * Facts read more than once (Phase 37.4). When two passages give a fact different values, the first stays the proposal and
 * the others are kept beside it as alternatives (at most `MAX_ALTERNATIVES`), each with its own quote — the person chooses,
 * nothing is decided by guess. The work plan's span is offered for the project's dates the same way, from the activities'
 * own rows. Countries are written with the list's names (`recogniseCountry`); a word the list does not know is kept as
 * written and flagged. Pure.
 */
import { compareDates, isPlainDate } from "../workplan/plain-date.js";
import { countriesInText, recogniseCountry } from "./country-names.js";
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

/**
 * The countries the proposed places name (a place of level 0, or a parent that is a country), offered for the project's
 * countries when the facts do not name them — the facts may have read a donor's country ("United States Agency for…") where
 * the places say where the work is. Offered, never swapped in.
 */
export function offerPlaceCountries(proposal: ProjectSetupProposal): ProjectSetupProposal {
  const item = proposal.facts.countries;
  if (item.status === "EDITED" || item.status === "REJECTED") return proposal;
  const stated = new Set((item.value ?? []).map((c) => recogniseCountry(c) ?? c));
  let next: Proposed<string[]> = item;
  for (const place of proposal.places) {
    if (place.status === "REJECTED" || !place.value || !place.sourceQuote) continue;
    const named = [place.value.name, place.value.parentName].flatMap((n) => (n ? [recogniseCountry(n) ?? countriesInText(n)[0] ?? null] : [])).filter((c): c is string => c !== null);
    const missing = named.filter((c) => !stated.has(c) && countriesInText(place.sourceQuote!).includes(c));
    if (missing.length === 0) continue;
    next = withAlternative(next, { value: [...new Set(missing)], sourceQuote: place.sourceQuote, sourceRef: place.sourceRef });
  }
  return next === item ? proposal : { ...proposal, facts: { ...proposal.facts, countries: next } };
}

/**
 * Budget lines and funding read with no currency get the project's own stated currency (the facts' reading, e.g. from
 * "Project budget $500,000.30"), as a MEDIUM-confidence proposal the person still confirms. A line that names its own
 * currency is never changed; nothing is offered when the project's currency is not stated.
 */
export function offerProjectCurrency(proposal: ProjectSetupProposal): ProjectSetupProposal {
  const stated = proposal.facts.currency;
  const fromFacts = stated.status !== "REJECTED" && typeof stated.value === "string" && /^[A-Z]{3}$/.test(stated.value) ? stated.value : null;
  // With no stated project currency, the one currency all the funding names (from "$500,000.30") is the next best reading.
  const funded = [...new Set(proposal.funding.flatMap((f) => (f.status !== "REJECTED" && f.value?.currency ? [f.value.currency] : [])))];
  const code = fromFacts ?? (funded.length === 1 ? funded[0]! : null);
  if (!code) return proposal;
  const fill = <T extends { currency: string | null; amount: string | null }>(item: Proposed<T>): Proposed<T> =>
    item.value && !item.value.currency && item.value.amount && item.status !== "EDITED" && item.status !== "REJECTED"
      ? { ...item, value: { ...item.value, currency: code }, confidence: "MEDIUM" }
      : item;
  return { ...proposal, funding: proposal.funding.map(fill), budget: proposal.budget.map(fill) };
}
