/** The text filters, in the order they are written into a link. `page` is handled separately (a whole number, 1 is left out). */
const TEXT_FILTERS = [
  "query",
  "verificationStatus",
  "confidentialityLevel",
  "evidenceType",
  "projectId",
  "reportingPeriodId",
  "location",
  "donor",
  "country",
] as const;

export const EVIDENCE_SEARCH_FILTERS = [...TEXT_FILTERS, "page"] as const;

export type EvidenceFilterName = (typeof EVIDENCE_SEARCH_FILTERS)[number];

export type EvidenceSearchParams = {
  query?: string;
  verificationStatus?: string;
  confidentialityLevel?: string;
  evidenceType?: string;
  /** The API filters by project and period; the project page fixes the project, the library page lets the person choose. */
  projectId?: string;
  reportingPeriodId?: string;
  /** Matched as typed against where the evidence was collected. */
  location?: string;
  /** A project's donor and country are not evidence fields: the library page keeps the evidence of projects with that donor or country. */
  donor?: string;
  country?: string;
  page?: number;
};

/**
 * Parses raw URL search params into a typed, validated filter object.
 * Unknown or malformed values are dropped rather than forwarded to the API.
 */
export function parseEvidenceFilters(entries: Iterable<[string, string]>): EvidenceSearchParams {
  const params: EvidenceSearchParams = {};
  const map = new Map<string, string>();
  for (const [key, value] of entries) map.set(key, value);

  for (const key of TEXT_FILTERS) {
    const value = map.get(key)?.trim();
    if (value) params[key] = value;
  }

  const pageRaw = map.get("page")?.trim();
  const page = pageRaw ? Number(pageRaw) : undefined;
  if (page !== undefined && Number.isInteger(page) && page >= 1) {
    params.page = page;
  }

  return params;
}

/**
 * Serializes a filter object into a URL query string for link building.
 */
export function serializeEvidenceFilters(params: EvidenceSearchParams): string {
  const search = new URLSearchParams();
  for (const key of EVIDENCE_SEARCH_FILTERS) {
    const value = params[key as EvidenceFilterName];
    if (value === undefined || value === null) continue;
    if (key === "page" && value === 1) continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/** Builds a new filter object with a single field changed (keeping the rest). */
export function withEvidenceFilter(
  current: EvidenceSearchParams,
  key: EvidenceFilterName,
  value: string | number | undefined,
): EvidenceSearchParams {
  const next: EvidenceSearchParams = { ...current };
  delete next.page;
  const empty = value === undefined || value === "";
  if (key === "page") {
    if (!empty) next.page = Number(value);
    return next;
  }
  if (empty) delete next[key];
  else next[key] = String(value);
  return next;
}

/** The evidence of projects with a given donor and/or country (case-insensitive), from a list of projects. */
export function projectIdsFor<T extends { id: string; donorName: string; country: string }>(projects: ReadonlyArray<T>, filters: Pick<EvidenceSearchParams, "donor" | "country">): Set<string> | null {
  if (!filters.donor && !filters.country) return null;
  const same = (a: string, b: string | undefined): boolean => !b || a.trim().toLowerCase() === b.trim().toLowerCase();
  return new Set(projects.filter((p) => same(p.donorName, filters.donor) && same(p.country, filters.country)).map((p) => p.id));
}
