/**
 * Provenance (Phase 31): every infographic can say which project data produced it. The footer
 * stamp is built here once, so the browser preview and the exported image cannot disagree, and the
 * same object is stored beside every published export.
 */
export interface InfographicProvenance {
  source: "project-records";
  /** The reporting-period labels whose records feed the design, in order. */
  periodLabels: string[];
  /** The indicator codes quoted anywhere in the design. */
  indicatorCodes: string[];
  /** When the design was rendered (injected — the composer never reads a clock itself). */
  generatedAt: string;
  /** Recorded values plotted that are not yet verified (the badge count). */
  unverifiedCount: number;
  /** Indicators with no recorded value at all (shown "Not yet reported"). */
  notYetReportedCount: number;
}

export function buildProvenance(input: {
  generatedAt: string;
  periodLabels?: readonly string[];
  indicatorCodes?: readonly string[];
  unverifiedCount?: number;
  notYetReportedCount?: number;
}): InfographicProvenance {
  return {
    source: "project-records",
    periodLabels: [...(input.periodLabels ?? [])],
    indicatorCodes: [...(input.indicatorCodes ?? [])],
    generatedAt: input.generatedAt,
    unverifiedCount: input.unverifiedCount ?? 0,
    notYetReportedCount: input.notYetReportedCount ?? 0,
  };
}

const shortDate = (iso: string): string => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
};

const joinList = (values: readonly string[]): string => {
  if (values.length === 0) return "";
  const first = values[0] ?? "";
  if (values.length === 1) return first;
  const last = values[values.length - 1] ?? "";
  return `${first} – ${last}`;
};

/** The one-line footer: what data, how fresh, what is not verified. Plain words, no codes. */
export function provenanceFooter(provenance: InfographicProvenance): string {
  const parts: string[] = [];
  const periods = joinList(provenance.periodLabels);
  if (periods) parts.push(`Data: ${periods}`);
  if (provenance.indicatorCodes.length > 0) parts.push(`Indicators ${joinList(provenance.indicatorCodes)}`);
  if (provenance.unverifiedCount > 0) parts.push(`${provenance.unverifiedCount} value${provenance.unverifiedCount === 1 ? "" : "s"} not yet verified`);
  if (provenance.notYetReportedCount > 0) parts.push(`${provenance.notYetReportedCount} not yet reported`);
  parts.push(`Generated ${shortDate(provenance.generatedAt)}`);
  return parts.join(" · ");
}
