import { DomainEvent } from "../../core/domain-event.js";
import { TenantId } from "../../value-objects/tenant-id.js";

export class ChecklistItemResolved extends DomainEvent {
  readonly eventName = "compliance.checklist.resolved";
  constructor(public readonly tenantId: TenantId, public readonly checklistItemId: string) {
    super();
  }
}

export class ReadinessScoreChanged extends DomainEvent {
  readonly eventName = "compliance.readiness.changed";
  constructor(
    public readonly tenantId: TenantId,
    public readonly reportingPeriodId: string,
    public readonly oldScore: number,
    public readonly newScore: number,
  ) {
    super();
  }
}
