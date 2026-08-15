import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";
import { TenantId } from "../../value-objects/tenant-id.js";
import type { StorageProvider } from "../evidence/evidence-file.js";
import type { OrganizationType, Sector, LanguageCode } from "./role.js";

export type DataResidency = "EU" | "US" | "AFRICA" | "ASIA" | "DEFAULT";

export const DATA_RESIDENCY_OPTIONS: DataResidency[] = ["EU", "US", "AFRICA", "ASIA", "DEFAULT"];

/** Account-wide default reporting profile applied to every new project. */
export interface OrganizationReportingDefaults {
  tone: "FORMAL" | "CONCISE" | "NARRATIVE" | "TECHNICAL";
  formattingRules: string[];
  deadlineOffsetDays?: number;
  autoPeriodCreation: boolean;
}

export interface OrganizationProps {
  name: string;
  organizationType: OrganizationType;
  country: string;
  sectors: Sector[];
  contactName: string;
  contactEmail: string;
  website?: string;
  defaultLanguage: LanguageCode;
  logoUrl?: string;
  mainOfficeLocation?: string;
  donorTypesServed?: string;
  dataResidency: DataResidency;
  aiEnabled: boolean;
  storageProvider: StorageProvider;
  reportingDefaults: OrganizationReportingDefaults;
}

export class Organization extends Entity<string> {
  private constructor(
    id: string,
    readonly tenantId: TenantId,
    private props: OrganizationProps,
    createdAt?: Date,
  ) {
    super(id, createdAt);
  }

  static create(input: { id: string; tenantId: TenantId; props: OrganizationProps }): Organization {
    Organization.validateProps(input.props);
    return new Organization(input.id, input.tenantId, input.props);
  }

  static rehydrate(input: {
    id: string;
    tenantId: TenantId;
    props: OrganizationProps;
    createdAt: Date;
  }): Organization {
    Organization.validateProps(input.props);
    return new Organization(input.id, input.tenantId, input.props, input.createdAt);
  }

  static defaultReportingDefaults(): OrganizationReportingDefaults {
    return { tone: "FORMAL", formattingRules: [], autoPeriodCreation: false };
  }

  private static validateProps(p: OrganizationProps): void {
    if (!p.name || p.name.trim().length < 2) throw DomainError.validation("Organization name required");
    if (!p.contactName) throw DomainError.validation("Contact name required");
    if (!p.contactEmail || !/.+@.+\..+/.test(p.contactEmail)) {
      throw DomainError.validation("Valid contact email required");
    }
    if (!p.country) throw DomainError.validation("Country required");
    if (!Array.isArray(p.sectors) || p.sectors.length === 0) {
      throw DomainError.validation("At least one sector required");
    }
  }

  get name(): string { return this.props.name; }
  get organizationType(): OrganizationType { return this.props.organizationType; }
  get country(): string { return this.props.country; }
  get sectors(): Sector[] { return [...this.props.sectors]; }
  get defaultLanguage(): LanguageCode { return this.props.defaultLanguage; }
  get contactEmail(): string { return this.props.contactEmail; }
  get contactName(): string { return this.props.contactName; }
  get website(): string | undefined { return this.props.website; }
  get logoUrl(): string | undefined { return this.props.logoUrl; }
  get mainOfficeLocation(): string | undefined { return this.props.mainOfficeLocation; }
  get donorTypesServed(): string | undefined { return this.props.donorTypesServed; }
  get dataResidency(): DataResidency { return this.props.dataResidency; }
  get aiEnabled(): boolean { return this.props.aiEnabled; }
  get storageProvider(): StorageProvider { return this.props.storageProvider; }
  get reportingDefaults(): OrganizationReportingDefaults {
    return {
      tone: this.props.reportingDefaults.tone,
      formattingRules: [...this.props.reportingDefaults.formattingRules],
      deadlineOffsetDays: this.props.reportingDefaults.deadlineOffsetDays,
      autoPeriodCreation: this.props.reportingDefaults.autoPeriodCreation,
    };
  }

  updateReportingDefaults(patch: Partial<OrganizationReportingDefaults>): void {
    this.props.reportingDefaults = {
      ...this.props.reportingDefaults,
      ...patch,
      formattingRules: patch.formattingRules ? [...patch.formattingRules] : this.props.reportingDefaults.formattingRules,
    };
    this.touch();
  }

  updateProfile(patch: Partial<OrganizationProps>): void {
    this.props = { ...this.props, ...patch };
    Organization.validateProps(this.props);
    this.touch();
  }
}
