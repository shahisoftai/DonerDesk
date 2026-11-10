/**
 * The guided start (Phase 48.18): a person says what they want to do in plain words and the form picks the starter that fits; a starter
 * names roles ("the headline indicator") and the form offers an indicator for each only when a word the two share says so. Pure.
 */
export interface Goal { key: string; label: string; help: string; templateId: string }

/** One row per thing a person comes to do. A new starter that fits a goal is a new row; a goal never names a block. */
export const GOALS: readonly Goal[] = [
  { key: "progress", label: "Show how a project is progressing", help: "Headline figures and charts against targets.", templateId: "builtin-results-glance" },
  { key: "donor", label: "Give a donor a one-page summary", help: "A single page to share or print.", templateId: "builtin-donor-one-pager" },
  { key: "update", label: "Send a quick update", help: "A short flash update with the key figures and a note.", templateId: "builtin-flash-update" },
  { key: "reach", label: "Show who we have reached", help: "People reached, by group and place.", templateId: "builtin-people-reached" },
  { key: "money", label: "Show funding and spending", help: "Funding received, spent and what remains.", templateId: "builtin-funding-burn" },
  { key: "where", label: "Show who does what, where", help: "Coverage by place (3W).", templateId: "builtin-3w-coverage" },
  { key: "field", label: "Follow field operations", help: "Planned work, late items and sites.", templateId: "builtin-field-operations" },
  { key: "sector", label: "Score a sector's results", help: "A scorecard of the sector's indicators.", templateId: "builtin-sector-scorecard" },
];

const STOP = new Set(["the", "and", "for", "with", "per", "number", "total", "indicator", "headline", "main", "optional"]);
const words = (text: string): string[] => text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w));

export interface RoleLike { key: string; label: string }
export interface IndicatorLike { id: string; code: string; name: string }

/** An indicator for a role only when they share a word; never reused for another role, never a guess from nothing. */
export function suggestRoles(roles: ReadonlyArray<RoleLike>, indicators: ReadonlyArray<IndicatorLike>): Record<string, string> {
  const taken = new Set<string>();
  const out: Record<string, string> = {};
  for (const r of roles) {
    const wanted = new Set(words(r.label));
    let best: { id: string; score: number } | null = null;
    for (const i of indicators) {
      if (taken.has(i.id)) continue;
      const score = words(i.name).filter((w) => wanted.has(w)).length;
      if (score > 0 && (!best || score > best.score)) best = { id: i.id, score };
    }
    if (best) { out[r.key] = best.id; taken.add(best.id); }
  }
  return out;
}
