/**
 * Which of the project's own indicators answers each indicator the donor's template asks for. Pure and deterministic: a requirement is
 * MAPPED when its text names an indicator's code or a person confirmed one, SUGGESTED when its wording is close to one indicator's name
 * (a person still confirms), UNMAPPED when nothing fits, and NOT_TRACKED when a person decided the project will not report it.
 * Nothing here ever changes an indicator or a value.
 */
export interface DonorIndicatorRequirement {
  id: string;
  text: string;
}

export interface MappableIndicator {
  id: string;
  code: string;
  name: string;
}

/** A person's decision about one requirement: an indicator, or null for "this project will not report it". */
export type DonorIndicatorDecision = { indicatorId: string | null };

export type DonorIndicatorMappingStatus = "MAPPED" | "SUGGESTED" | "UNMAPPED" | "NOT_TRACKED";

export interface DonorIndicatorMappingRow {
  requirementId: string;
  text: string;
  status: DonorIndicatorMappingStatus;
  /** The indicator that answers it (MAPPED), or the best guess (SUGGESTED). */
  indicatorId: string | null;
  /** Why this status, in plain words. */
  basis: string;
  /** Other indicators that came close, best first, for the person choosing. */
  alternatives: string[];
}

/** Words that say nothing about what is measured. */
const STOP = new Set([
  "the", "a", "an", "of", "and", "or", "in", "on", "for", "to", "by", "with", "at", "from", "as", "per", "number", "percent", "percentage", "proportion",
  "total", "report", "reporting", "indicator", "indicators", "disaggregated", "sex", "age", "who", "that", "are", "is", "be", "have", "has", "been", "their", "this", "all",
]);

const tokens = (text: string): string[] =>
  text.toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length > 2 && !STOP.has(t)).map((t) => (t.length > 4 && t.endsWith("s") ? t.slice(0, -1) : t));

/** Share of the indicator name's meaningful words that the requirement also uses (0 to 1). */
export function nameOverlap(requirementText: string, indicatorName: string): number {
  const wanted = new Set(tokens(indicatorName));
  if (wanted.size === 0) return 0;
  const have = new Set(tokens(requirementText));
  let shared = 0;
  for (const t of wanted) if (have.has(t)) shared += 1;
  return shared / wanted.size;
}

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** True when the text names the code as a whole token ("IND-W-001"), not as part of a longer one. */
export function namesCode(text: string, code: string): boolean {
  if (code.trim() === "") return false;
  return new RegExp(`(^|[^A-Za-z0-9])${escapeRegExp(code.trim())}($|[^A-Za-z0-9])`, "i").test(text);
}

/** Minimum overlap for a suggestion, and how far ahead of the runner-up the best one must be to be offered alone. */
export const SUGGEST_AT_LEAST = 0.6;

export function mapDonorIndicators(
  requirements: ReadonlyArray<DonorIndicatorRequirement>,
  indicators: ReadonlyArray<MappableIndicator>,
  decisions: ReadonlyMap<string, DonorIndicatorDecision> | Readonly<Record<string, DonorIndicatorDecision>> = {},
): DonorIndicatorMappingRow[] {
  const decided = (id: string): DonorIndicatorDecision | undefined => (decisions instanceof Map ? decisions.get(id) : (decisions as Record<string, DonorIndicatorDecision>)[id]);
  const liveIds = new Set(indicators.map((i) => i.id));
  return requirements.map((req) => {
    const ranked = indicators
      .map((i) => ({ i, score: nameOverlap(req.text, i.name) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.i.code.localeCompare(b.i.code, undefined, { numeric: true }));
    const alternatives = ranked.slice(0, 3).map((x) => x.i.id);
    const base = { requirementId: req.id, text: req.text, alternatives };

    const decision = decided(req.id);
    if (decision) {
      if (decision.indicatorId === null) return { ...base, status: "NOT_TRACKED" as const, indicatorId: null, basis: "Someone decided this project will not report it." };
      // A decision naming an indicator that was since removed no longer counts: the donor's question is open again.
      if (liveIds.has(decision.indicatorId)) return { ...base, status: "MAPPED" as const, indicatorId: decision.indicatorId, basis: "Confirmed by a person." };
    }

    const byCode = indicators.filter((i) => namesCode(req.text, i.code));
    if (byCode.length === 1) return { ...base, status: "MAPPED" as const, indicatorId: byCode[0]!.id, basis: `The donor's text names the code ${byCode[0]!.code}.` };

    const best = ranked[0];
    const runnerUp = ranked[1];
    if (best && best.score >= SUGGEST_AT_LEAST && (!runnerUp || best.score > runnerUp.score)) {
      return { ...base, status: "SUGGESTED" as const, indicatorId: best.i.id, basis: `The wording is close to "${best.i.name}". Confirm it or choose another.` };
    }
    return { ...base, status: "UNMAPPED" as const, indicatorId: null, basis: "No indicator of this project matches it yet." };
  });
}

export interface DonorIndicatorMappingSummary {
  total: number;
  mapped: number;
  suggested: number;
  unmapped: number;
  notTracked: number;
}

export function summariseDonorIndicatorMapping(rows: ReadonlyArray<DonorIndicatorMappingRow>): DonorIndicatorMappingSummary {
  const count = (s: DonorIndicatorMappingStatus): number => rows.filter((r) => r.status === s).length;
  return { total: rows.length, mapped: count("MAPPED"), suggested: count("SUGGESTED"), unmapped: count("UNMAPPED"), notTracked: count("NOT_TRACKED") };
}

/** What still needs a person: requirements that are unmapped or only suggested. A "not tracked" decision is an answer, not a gap. */
export function openDonorIndicatorQuestions(rows: ReadonlyArray<DonorIndicatorMappingRow>): number {
  return rows.filter((r) => r.status === "UNMAPPED" || r.status === "SUGGESTED").length;
}
