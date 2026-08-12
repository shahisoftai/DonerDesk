import { DomainEvent } from "../../core/domain-event.js";
import { TenantId } from "../../value-objects/tenant-id.js";

export class IndicatorUpdated extends DomainEvent {
  readonly eventName = "logframe.indicator.updated";
  constructor(public readonly tenantId: TenantId, public readonly indicatorId: string, public readonly reportingPeriodId: string) {
    super();
  }
}

export class IndicatorVerified extends DomainEvent {
  readonly eventName = "logframe.indicator.verified";
  constructor(
    public readonly tenantId: TenantId,
    public readonly indicatorUpdateId: string,
    public readonly verifiedById: string,
  ) {
    super();
  }
}
