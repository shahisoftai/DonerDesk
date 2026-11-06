import type { SetupDraftView } from "../../../../lib/server/schemas-project-setup-draft.ts";

export interface StartSuggestions { donor: string | null; country: string | null }

const live = <T extends { status: string }>(items: readonly T[]): T[] => items.filter((i) => i.status !== "REJECTED");

/**
 * What the documents point to for the first slide. Only offered when exactly one answer is stated (two countries or two funders
 * is a choice for the person, not a guess); a sector is never derived, since no document names it in a form we can trust.
 */
export function startSuggestions(view: SetupDraftView): StartSuggestions {
  const only = (names: string[]): string | null => { const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))]; return unique.length === 1 ? unique[0]! : null; };
  const countries = live(view.places).filter((p) => p.value.adminLevel === 0).map((p) => p.value.name ?? "");
  const donors = live(view.funding).map((f) => f.value.sourceName ?? "");
  return { donor: only(donors), country: only(countries) };
}
