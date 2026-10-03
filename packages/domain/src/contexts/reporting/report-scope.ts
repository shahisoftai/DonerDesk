/**
 * What an ad-hoc report covers beyond its date range. Cadence reports
 * (monthly/quarterly/…) cover the whole project and carry no scope; the
 * ad-hoc types each need a focus the writer and the checklist can use:
 *
 * - ACTIVITY  → which recorded activities (ActivityUpdate ids) the report is about
 * - SITUATION → the event/emergency, where, and the situation date
 * - CUSTOM    → a title and the purpose of the report
 */
export interface ReportScope {
  /** ACTIVITY: the project's activity-update ids this report covers. */
  activityIds?: string[];
  /** SITUATION: name of the event, emergency or situation. */
  eventName?: string;
  /** SITUATION: where it happened / the affected area. */
  location?: string;
  /** SITUATION: ISO date the situation refers to ("as of"). */
  situationDate?: string;
  /** SITUATION: optional short description of the situation. */
  summary?: string;
  /** CUSTOM: report title. */
  title?: string;
  /** CUSTOM: what the report is for. */
  purpose?: string;
  /** CUSTOM: the author's own section list (replaces the generic blueprint). */
  sections?: ReportScopeSection[];
  /** SITUATION (server-set): 1-based number of this report in the event's series. */
  sequence?: number;
  /** SITUATION (server-set): the previous report on the same event. */
  previousPeriodId?: string;
  /** SITUATION (server-set): ISO date the previous report was "as of". */
  previousSituationDate?: string;
}

export interface ReportScopeSection {
  title: string;
  /** What the section should cover; sent to the writer. */
  guidance?: string;
}

/** Same event across a series of situation reports (case/space-insensitive). */
export function normalizeEventName(name: string | undefined): string {
  return (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Report types that cover the whole project for a fixed cadence. */
export const CADENCE_REPORT_TYPES: ReadonlySet<string> = new Set(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL", "FINAL"]);

/** Report types that need a scope (an explicit focus). */
export const SCOPED_REPORT_TYPES: ReadonlySet<string> = new Set(["ACTIVITY", "SITUATION", "CUSTOM"]);

const trimmed = (v: unknown, max = 2000): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : undefined;
};

export function parseReportScope(json: string | null | undefined): ReportScope {
  if (!json || json === "{}") return {};
  try {
    return normalizeReportScope(JSON.parse(json));
  } catch {
    return {};
  }
}

/** Keeps only the known, non-empty fields. */
export function normalizeReportScope(raw: unknown): ReportScope {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const out: ReportScope = {};
  if (Array.isArray(r.activityIds)) {
    const ids = Array.from(new Set(r.activityIds.filter((x): x is string => typeof x === "string" && x.length > 0)));
    if (ids.length > 0) out.activityIds = ids;
  }
  if (Array.isArray(r.sections)) {
    const sections = r.sections
      .map((x) => (x && typeof x === "object" ? (x as Record<string, unknown>) : {}))
      .map((x) => ({ title: trimmed(x.title, 200), guidance: trimmed(x.guidance, 1000) }))
      .filter((x): x is { title: string; guidance: string | undefined } => Boolean(x.title))
      .slice(0, 25)
      .map((x) => (x.guidance ? { title: x.title, guidance: x.guidance } : { title: x.title }));
    if (sections.length > 0) out.sections = sections;
  }
  if (typeof r.sequence === "number" && Number.isInteger(r.sequence) && r.sequence >= 1) out.sequence = r.sequence;
  for (const key of ["previousPeriodId", "previousSituationDate"] as const) {
    const v = trimmed(r[key], 80);
    if (v) out[key] = v;
  }
  for (const key of ["eventName", "location", "situationDate", "summary", "title", "purpose"] as const) {
    const v = trimmed(r[key], key === "summary" || key === "purpose" ? 2000 : 300);
    if (v) out[key] = v;
  }
  return out;
}

/** Missing required scope fields for a report type (empty = valid). Field names are scope keys. */
export function missingScopeFields(reportType: string, scope: ReportScope): Array<keyof ReportScope> {
  switch (reportType) {
    case "ACTIVITY":
      return scope.activityIds?.length ? [] : ["activityIds"];
    case "SITUATION": {
      const missing: Array<keyof ReportScope> = [];
      if (!scope.eventName) missing.push("eventName");
      if (!scope.situationDate) missing.push("situationDate");
      return missing;
    }
    case "CUSTOM":
      return scope.title ? [] : ["title"];
    default:
      return [];
  }
}

/**
 * One-paragraph statement of the focus for the writer prompt (empty when the
 * scope has nothing to say). `activityTitles` resolves ids → titles.
 */
export function describeReportScope(reportType: string, scope: ReportScope, activityTitles: string[] = []): string {
  const parts: string[] = [];
  if (reportType === "ACTIVITY") {
    if (activityTitles.length > 0) {
      parts.push(
        `Activity report covering ${activityTitles.length === 1 ? "one activity" : `${activityTitles.length} activities`}: ${activityTitles.join("; ")}. Report only on these activities; do not report on other project work, and do not write project-wide summaries.`,
      );
    }
  } else if (reportType === "SITUATION") {
    parts.push(`Situation report${scope.sequence ? ` #${scope.sequence}` : ""}${scope.eventName ? ` on: ${scope.eventName}` : ""}.`);
    if (scope.location) parts.push(`Location / affected area: ${scope.location}.`);
    if (scope.situationDate) parts.push(`Situation as of ${scope.situationDate}.`);
    if (scope.previousSituationDate) parts.push(`The previous report on this event was as of ${scope.previousSituationDate}; emphasise what has changed since then.`);
    if (scope.summary) parts.push(`Context: ${scope.summary}`);
  } else if (reportType === "CUSTOM") {
    if (scope.title) parts.push(`Report title: ${scope.title}.`);
    if (scope.purpose) parts.push(`Purpose: ${scope.purpose}`);
  }
  return parts.join(" ");
}
