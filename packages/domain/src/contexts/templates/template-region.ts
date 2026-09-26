/**
 * A structural region detected in a donor's uploaded DOCX template (a
 * heading or a table), the unit that `auto-map-regions.ts` matches against
 * DonorDesk's own `TemplateSection`s. Produced by the infrastructure-layer
 * structural parser; this file only defines the shape domain code consumes,
 * so domain stays free of any parsing-library dependency.
 */
export type TemplateRegionKind = "HEADING" | "TABLE";

export interface TemplateRegion {
  /** Positionally deterministic within one parse, e.g. "h-0003" / "t-0001". */
  id: string;
  kind: TemplateRegionKind;
  /** Heading level 1-6; undefined for TABLE regions. */
  level?: number;
  /** Heading text, or the table's header-row text joined, for matching. */
  text: string;
  /** Document order — used for stable tie-breaking and for the worker to
   * relocate the same region when inserting placeholders. */
  order: number;
  /** Table header-row cell text, when kind === "TABLE". */
  tableColumns?: string[];
}
