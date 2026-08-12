import { Entity } from "../../core/entity.js";
import { DomainError } from "../../core/domain-error.js";
import { TenantId } from "../../value-objects/tenant-id.js";
import { DateRange } from "../../value-objects/date-range.js";
import { Money } from "../../value-objects/money.js";
import type { Sector } from "../identity/role.js";

export type ProjectStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";

export type ReportingFrequency = "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "ANNUAL" | "FINAL" | "CUSTOM";

export const REPORTING_FREQUENCIES: ReportingFrequency[] = [
  "MONTHLY",
  "QUARTERLY",
  "SEMI_ANNUAL",
  "ANNUAL",
  "FINAL",
  "CUSTOM",
];

export interface ProjectProps {
  title: string;
  projectCode: string;
  donorName: string;
  implementingOrganization: string;
  partnerOrganization?: string;
  country: string;
  region?: string;
  district?: string;
  sector: Sector;
  duration: DateRange;
  budget?: Money;
  reportingFrequency: ReportingFrequency;
  description?: string;
  primaryContactName?: string;
  projectManagerId?: string;
  meOfficerId?: string;
  reportingOfficerId?: string;
  status: ProjectStatus;
}

export class Project extends Entity<string> {
  private constructor(
    id: string,
    readonly tenantId: TenantId,
    private props: ProjectProps,
    createdAt?: Date,
  ) {
    super(id, createdAt);
  }

  static create(input: {
    id: string;
    tenantId: TenantId;
    props: Omit<ProjectProps, "duration" | "budget" | "status"> & {
      startDate: Date;
      endDate: Date;
      budgetAmount?: number;
      budgetCurrency?: string;
    };
  }): Project {
    Project.validate(input.props);
    return new Project(input.id, input.tenantId, {
      title: input.props.title,
      projectCode: input.props.projectCode,
      donorName: input.props.donorName,
      implementingOrganization: input.props.implementingOrganization,
      partnerOrganization: input.props.partnerOrganization,
      country: input.props.country,
      region: input.props.region,
      district: input.props.district,
      sector: input.props.sector,
      duration: DateRange.create(input.props.startDate, input.props.endDate),
      budget:
        input.props.budgetAmount !== undefined
          ? Money.create(input.props.budgetAmount, input.props.budgetCurrency ?? "USD")
          : undefined,
      reportingFrequency: input.props.reportingFrequency,
      description: input.props.description,
      primaryContactName: input.props.primaryContactName,
      projectManagerId: input.props.projectManagerId,
      meOfficerId: input.props.meOfficerId,
      reportingOfficerId: input.props.reportingOfficerId,
      status: "DRAFT",
    });
  }

  static rehydrate(input: {
    id: string;
    tenantId: TenantId;
    props: ProjectProps;
    createdAt: Date;
  }): Project {
    return new Project(input.id, input.tenantId, input.props, input.createdAt);
  }

  private static validate(p: {
    title: string;
    projectCode: string;
    donorName: string;
    implementingOrganization: string;
    country: string;
    sector: Sector;
    reportingFrequency: ReportingFrequency;
  }): void {
    if (!p.title || p.title.trim().length < 2) throw DomainError.validation("Project title required");
    if (!p.projectCode) throw DomainError.validation("Project code required");
    if (!p.donorName) throw DomainError.validation("Donor name required");
    if (!p.implementingOrganization) throw DomainError.validation("Implementing organization required");
    if (!p.country) throw DomainError.validation("Country required");
    if (!p.sector) throw DomainError.validation("Sector required");
    if (!p.reportingFrequency) throw DomainError.validation("Reporting frequency required");
  }

  get title(): string { return this.props.title; }
  get projectCode(): string { return this.props.projectCode; }
  get donorName(): string { return this.props.donorName; }
  get implementingOrganization(): string { return this.props.implementingOrganization; }
  get partnerOrganization(): string | undefined { return this.props.partnerOrganization; }
  get country(): string { return this.props.country; }
  get region(): string | undefined { return this.props.region; }
  get district(): string | undefined { return this.props.district; }
  get sector(): Sector { return this.props.sector; }
  get duration(): DateRange { return this.props.duration; }
  get budget(): Money | undefined { return this.props.budget; }
  get reportingFrequency(): ReportingFrequency { return this.props.reportingFrequency; }
  get description(): string | undefined { return this.props.description; }
  get primaryContactName(): string | undefined { return this.props.primaryContactName; }
  get projectManagerId(): string | undefined { return this.props.projectManagerId; }
  get meOfficerId(): string | undefined { return this.props.meOfficerId; }
  get reportingOfficerId(): string | undefined { return this.props.reportingOfficerId; }
  get status(): ProjectStatus { return this.props.status; }

  activate(): void {
    if (this.props.status === "ARCHIVED") throw DomainError.invalidTransition("Cannot activate archived project");
    this.props.status = "ACTIVE";
    this.touch();
  }

  pause(): void {
    if (this.props.status !== "ACTIVE") throw DomainError.invalidTransition("Only active projects can be paused");
    this.props.status = "PAUSED";
    this.touch();
  }

  complete(): void {
    if (this.props.status === "ARCHIVED") throw DomainError.invalidTransition("Cannot complete archived project");
    this.props.status = "COMPLETED";
    this.touch();
  }

  archive(): void {
    this.props.status = "ARCHIVED";
    this.touch();
  }

  assignStaff(input: {
    projectManagerId?: string;
    meOfficerId?: string;
    reportingOfficerId?: string;
  }): void {
    if (input.projectManagerId !== undefined) this.props.projectManagerId = input.projectManagerId;
    if (input.meOfficerId !== undefined) this.props.meOfficerId = input.meOfficerId;
    if (input.reportingOfficerId !== undefined) this.props.reportingOfficerId = input.reportingOfficerId;
    this.touch();
  }

  updateDetails(patch: Partial<Omit<ProjectProps, "duration" | "budget" | "status">>): void {
    this.props = { ...this.props, ...patch };
    this.touch();
  }

  daysRemaining(): number {
    const today = new Date();
    const ms = this.props.duration.end.getTime() - today.getTime();
    return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
  }
}
