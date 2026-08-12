export const EVIDENCE_SEARCH_FILTERS = [
  "query",
  "verificationStatus",
  "confidentialityLevel",
  "evidenceType",
  "page",
] as const;

export type EvidenceFilterName = (typeof EVIDENCE_SEARCH_FILTERS)[number];

export type EvidenceSearchParams = {
  query?: string;
  verificationStatus?: string;
  confidentialityLevel?: string;
  evidenceType?: string;
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

  const query = map.get("query")?.trim();
  if (query) params.query = query;

  const verificationStatus = map.get("verificationStatus")?.trim();
  if (verificationStatus) params.verificationStatus = verificationStatus;

  const confidentialityLevel = map.get("confidentialityLevel")?.trim();
  if (confidentialityLevel) params.confidentialityLevel = confidentialityLevel;

  const evidenceType = map.get("evidenceType")?.trim();
  if (evidenceType) params.evidenceType = evidenceType;

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
  const next: EvidenceSearchParams = {
    query: current.query,
    verificationStatus: current.verificationStatus,
    confidentialityLevel: current.confidentialityLevel,
    evidenceType: current.evidenceType,
  };
  const empty = value === undefined || value === "";
  if (key === "page") {
    if (!empty) next.page = Number(value);
  } else {
    if (empty) delete next[key];
    else next[key] = String(value);
  }
  if (key !== "page") delete next.page;
  return next;
}
