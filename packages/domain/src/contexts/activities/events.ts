import { DomainEvent } from "../../core/domain-event.js";
import { TenantId } from "../../value-objects/tenant-id.js";

export class ActivitySubmitted extends DomainEvent {
  readonly eventName = "activity.submitted";
  constructor(public readonly tenantId: TenantId, public readonly activityId: string, public readonly projectId: string) {
    super();
  }
}

export class ActivityApproved extends DomainEvent {
  readonly eventName = "activity.approved";
  constructor(public readonly tenantId: TenantId, public readonly activityId: string, public readonly approvedById: string) {
    super();
  }
}
