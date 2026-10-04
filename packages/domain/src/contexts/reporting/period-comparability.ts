import { normalizeEventName, type ReportScope } from "./report-scope.js";

/**
 * Which earlier reporting periods a report may be compared with (indicator
 * deltas, prior narrative). A report is only comparable with reports of its own
 * kind: an activity or situation report that happens to sit inside a quarter
 * says nothing about how that quarter went.
 */
export interface PeriodComparability {
  /** Report types compared first, newest first. */
  primary: readonly string[];
  /** Used only when no primary period exists. */
  fallback: readonly string[];
  /** At most this many fallback periods are used. */
  fallbackLimit: number;
  /** Situation reports: only the same event (normalised name). */
  eventKey?: string;
}

const NONE: readonly string[] = [];

/** Null when the report type has no history to compare with (activity, custom). */
export function periodComparability(reportType: string, scope: ReportScope): PeriodComparability | null {
  switch (reportType) {
    case "MONTHLY":
    case "QUARTERLY":
    case "ANNUAL":
      return { primary: [reportType], fallback: NONE, fallbackLimit: 0 };
    case "SEMI_ANNUAL":
      return { primary: ["SEMI_ANNUAL"], fallback: ["QUARTERLY"], fallbackLimit: 2 };
    case "FINAL":
      return { primary: ["ANNUAL"], fallback: ["SEMI_ANNUAL", "QUARTERLY"], fallbackLimit: 2 };
    case "SITUATION": {
      const eventKey = normalizeEventName(scope.eventName);
      return { primary: ["SITUATION"], fallback: NONE, fallbackLimit: 0, ...(eventKey ? { eventKey } : {}) };
    }
    default:
      return null;
  }
}

/** Every report type a comparison may draw on (primary then fallback). */
export function comparableReportTypes(c: PeriodComparability): string[] {
  return [...c.primary, ...c.fallback];
}

/**
 * Picks the periods to compare with from `candidates` (newest first): the
 * primary-type ones, or up to `fallbackLimit` fallback-type ones when there are none.
 */
export function selectComparablePeriods<T extends { reportType: string }>(candidates: readonly T[], c: PeriodComparability, limit: number): T[] {
  const primary = candidates.filter((p) => c.primary.includes(p.reportType));
  if (primary.length > 0) return primary.slice(0, limit);
  return candidates.filter((p) => c.fallback.includes(p.reportType)).slice(0, Math.min(limit, c.fallbackLimit));
}

/**
 * Sections whose natural predecessor in the previous report has a different key:
 * "Developments Since the Last Report" builds on what the previous report said
 * "at a glance". Used only when looking for a section's predecessor, never the
 * other way round.
 */
const PREDECESSOR_ALIASES: Readonly<Record<string, readonly string[]>> = {
  changes: ["overview"],
};

const BLUEPRINT_ID_RE = /^bp:[a-z_]+:(.+)$/;

/**
 * Stable identity of a section across reports and languages: the blueprint key
 * (`bp:quarterly:exec` and `bp:semi_annual:exec` are both "exec"), else the
 * donor-template section id, else the normalised title.
 */
export function sectionMatchKeys(section: { templateSectionId?: string | null; canonicalTitle?: string; title?: string; sectionTitle?: string }): string[] {
  const keys: string[] = [];
  const id = section.templateSectionId ?? undefined;
  if (id) {
    const bp = BLUEPRINT_ID_RE.exec(id);
    keys.push(bp ? `bp:${bp[1]}` : `id:${id}`);
  }
  const title = (section.canonicalTitle ?? section.title ?? section.sectionTitle ?? "")
    .toLowerCase()
    .replace(/^\d+(?:\.\d+)*[.)]?\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (title) keys.push(`title:${title}`);
  return keys;
}

/** Keys that find the section's predecessor in an earlier report: its own keys, then predecessor aliases. */
export function sectionPredecessorKeys(section: Parameters<typeof sectionMatchKeys>[0]): string[] {
  const own = sectionMatchKeys(section);
  const bp = BLUEPRINT_ID_RE.exec(section.templateSectionId ?? "");
  const aliases = bp ? (PREDECESSOR_ALIASES[bp[1]!] ?? []).map((k) => `bp:${k}`) : [];
  // Own blueprint/template key first, aliases next, title last.
  const titleKeys = own.filter((k) => k.startsWith("title:"));
  return [...own.filter((k) => !k.startsWith("title:")), ...aliases, ...titleKeys];
}
