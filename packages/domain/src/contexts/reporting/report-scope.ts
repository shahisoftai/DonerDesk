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
    if (activityTitles.length > 0) parts.push(`Activity report focused only on: ${activityTitles.join("; ")}. Do not report on other activities.`);
  } else if (reportType === "SITUATION") {
    if (scope.eventName) parts.push(`Situation report on: ${scope.eventName}.`);
    if (scope.location) parts.push(`Location / affected area: ${scope.location}.`);
    if (scope.situationDate) parts.push(`Situation as of ${scope.situationDate}.`);
    if (scope.summary) parts.push(`Context: ${scope.summary}`);
  } else if (reportType === "CUSTOM") {
    if (scope.title) parts.push(`Report title: ${scope.title}.`);
    if (scope.purpose) parts.push(`Purpose: ${scope.purpose}`);
  }
  return parts.join(" ");
}
