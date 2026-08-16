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
