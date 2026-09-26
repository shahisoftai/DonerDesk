/**
 * A donor template mapping binds regions in the donor DOCX (headings, tables,
 * fields) to DonorDesk template sections and docxtpl placeholders. Mappings
 * are versioned and must be approved before they are locked to a reporting
 * period.
 */
export type MappingMethod = "AUTO" | "MANUAL";
export type MappingStatus = "DRAFT" | "REVIEWED" | "APPROVED";

export const MAPPING_STATUSES: MappingStatus[] = ["DRAFT", "REVIEWED", "APPROVED"];

export interface TemplateRegionMapping {
  regionId: string;
  templateSectionId: string;
  placeholderKey: string;
  mappedBy: MappingMethod;
  status: MappingStatus;
}

export class DonorTemplateMapping {
  private constructor(
    readonly id: string,
    readonly tenantIdValue: string,
    readonly templateId: string,
    readonly version: number,
    private regions: TemplateRegionMapping[],
    readonly approvedById: string | undefined,
    readonly approvedAt: Date | undefined,
    readonly createdAt: Date,
    /** Raw structural parse (including regions that never became a mapped
     * `TemplateRegionMapping`), so the review UI can show every detected
     * region without reparsing the original file. Never validated — it is
     * a cache, not an invariant-bearing collection. */
    readonly detectedRegions: unknown[] = [],
    readonly templatedFileUrl: string | undefined = undefined,
  ) {}

  static create(input: {
    id: string;
    tenantId: string;
    templateId: string;
    version?: number;
    regions: TemplateRegionMapping[];
    detectedRegions?: unknown[];
  }): DonorTemplateMapping {
    if (!input.templateId) throw new Error("Donor template id is required");
    for (const region of input.regions) {
      if (!region.regionId || !region.templateSectionId || !region.placeholderKey) {
        throw new Error("Every mapping region requires regionId, templateSectionId, and placeholderKey");
      }
    }
    return new DonorTemplateMapping(
      input.id,
      input.tenantId,
      input.templateId,
      input.version ?? 1,
      input.regions,
      undefined,
      undefined,
      new Date(),
      input.detectedRegions ?? [],
      undefined,
    );
  }

  static rehydrate(input: {
    id: string;
    tenantId: string;
    templateId: string;
    version: number;
    regions: TemplateRegionMapping[];
    approvedById: string | undefined;
    approvedAt: Date | undefined;
    createdAt: Date;
    detectedRegions?: unknown[];
    templatedFileUrl?: string;
  }): DonorTemplateMapping {
    return new DonorTemplateMapping(
      input.id,
      input.tenantId,
      input.templateId,
      input.version,
      input.regions,
      input.approvedById,
      input.approvedAt,
      input.createdAt,
      input.detectedRegions ?? [],
      input.templatedFileUrl,
    );
  }

  get regionsList(): TemplateRegionMapping[] {
    return [...this.regions];
  }

  /** Applies a manual correction to one region: reassigns its target
   * section/placeholder and marks it MANUAL + REVIEWED. Adds the region if
   * it was previously unmapped (not yet a `TemplateRegionMapping` entry).
   * Immutable — returns a new instance; never mutates `this`. */
  reviewedBy(regionId: string, templateSectionId: string, placeholderKey: string): DonorTemplateMapping {
    if (this.approvedAt) throw new Error("Cannot modify an approved mapping; create a new version instead");
    const existingIndex = this.regions.findIndex((r) => r.regionId === regionId);
    const updated: TemplateRegionMapping = { regionId, templateSectionId, placeholderKey, mappedBy: "MANUAL", status: "REVIEWED" };
    const nextRegions =
      existingIndex >= 0
        ? this.regions.map((r, i) => (i === existingIndex ? updated : r))
        : [...this.regions, updated];
    return new DonorTemplateMapping(
      this.id, this.tenantIdValue, this.templateId, this.version, nextRegions,
      this.approvedById, this.approvedAt, this.createdAt, this.detectedRegions, this.templatedFileUrl,
    );
  }

  /** Attaches the rendered "templated" DOCX (with placeholders physically
   * inserted) produced by the worker at approval time. */
  withTemplatedFile(templatedFileUrl: string): DonorTemplateMapping {
    return new DonorTemplateMapping(
      this.id, this.tenantIdValue, this.templateId, this.version, this.regions,
      this.approvedById, this.approvedAt, this.createdAt, this.detectedRegions, templatedFileUrl,
    );
  }

  /**
   * Approves the mapping, freezing it for lock-on to reporting periods.
   * Requires at least one region to be mapped, and every mapped region to
   * be REVIEWED (a still-DRAFT/AUTO-only region has never been seen by a
   * human) — regions the operator intentionally left unmapped are simply
   * absent from `regions` and do not block approval.
   */
  approve(by: string): DonorTemplateMapping {
    if (this.approvedAt) return this;
    if (this.regions.length === 0) {
      throw new Error("Cannot approve a mapping with no reviewed regions");
    }
    const unreviewed = this.regions.filter((r) => r.status !== "REVIEWED" && r.status !== "APPROVED");
    if (unreviewed.length > 0) {
      throw new Error(`Cannot approve: ${unreviewed.length} mapped region(s) have not been reviewed`);
    }
    const approvedRegions = this.regions.map((r) => ({ ...r, status: "APPROVED" as const }));
    return new DonorTemplateMapping(
      this.id, this.tenantIdValue, this.templateId, this.version, approvedRegions,
      by, new Date(), this.createdAt, this.detectedRegions, this.templatedFileUrl,
    );
  }
}
