import { DomainEvent } from "../../core/domain-event.js";
import { TenantId } from "../../value-objects/tenant-id.js";

export class ExportRequested extends DomainEvent {
  readonly eventName = "export.requested";
  constructor(public readonly tenantId: TenantId, public readonly exportId: string, public readonly exportType: string) {
    super();
  }
}

export class ExportCompleted extends DomainEvent {
  readonly eventName = "export.completed";
  constructor(public readonly tenantId: TenantId, public readonly exportId: string, public readonly fileUrl: string) {
    super();
  }
}
