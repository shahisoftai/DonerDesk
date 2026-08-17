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
  ) {}

  static create(input: {
    id: string;
    tenantId: string;
    templateId: string;
    version?: number;
    regions: TemplateRegionMapping[];
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
    );
  }

  get regionsList(): TemplateRegionMapping[] {
    return [...this.regions];
  }

  /** Approves the mapping, freezing it for lock-on to reporting periods. */
  approve(by: string): DonorTemplateMapping {
    if (this.approvedAt) return this;
    return new DonorTemplateMapping(this.id, this.tenantIdValue, this.templateId, this.version, this.regions, by, new Date(), this.createdAt);
  }
}
