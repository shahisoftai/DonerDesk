import { DomainEvent } from "../../core/domain-event.js";
import { TenantId } from "../../value-objects/tenant-id.js";

export class ReportingPeriodCreated extends DomainEvent {
  readonly eventName = "reporting.period.created";
  constructor(
    public readonly tenantId: TenantId,
    public readonly reportingPeriodId: string,
    public readonly projectId: string,
  ) {
    super();
  }
}

export class DraftGenerated extends DomainEvent {
  readonly eventName = "report.draft.generated";
  constructor(
    public readonly tenantId: TenantId,
    public readonly reportDraftId: string,
    public readonly reportingPeriodId: string,
    public readonly sectionCount: number,
  ) {
    super();
  }
}

export class SectionApproved extends DomainEvent {
  readonly eventName = "report.section.approved";
  constructor(public readonly tenantId: TenantId, public readonly sectionId: string, public readonly approvedById: string) {
    super();
  }
}

export class ReportApproved extends DomainEvent {
  readonly eventName = "report.approved";
  constructor(
    public readonly tenantId: TenantId,
    public readonly reportDraftId: string,
    public readonly approvedById: string,
  ) {
    super();
  }
}

export class ReportRevisionCreated extends DomainEvent {
  readonly eventName = "report.revision.created";
  constructor(
    public readonly tenantId: TenantId,
    public readonly revisionId: string,
    public readonly draftId: string,
    public readonly sectionId: string,
    public readonly revisionNumber: number,
    public readonly changeOrigin: string,
  ) {
    super();
  }
}

export class ReportSubmissionSnapshotCreated extends DomainEvent {
  readonly eventName = "report.submission.snapshot.created";
  constructor(
    public readonly tenantId: TenantId,
    public readonly snapshotId: string,
    public readonly draftId: string,
    public readonly reportingPeriodId: string,
  ) {
    super();
  }
}

export class ReportingRequirementPackPublished extends DomainEvent {
  readonly eventName = "reporting.requirement.pack.published";
  constructor(
    public readonly tenantId: TenantId,
    public readonly packId: string,
    public readonly donorKey: string,
    public readonly version: number,
  ) {
    super();
  }
}

export class AwardReportingOverridePublished extends DomainEvent {
  readonly eventName = "reporting.requirement.override.published";
  constructor(
    public readonly tenantId: TenantId,
    public readonly overrideId: string,
    public readonly awardId: string,
    public readonly projectId: string,
    public readonly version: number,
  ) {
    super();
  }
}
