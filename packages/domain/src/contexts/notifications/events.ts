import { DomainEvent } from "../../core/domain-event.js";
import { TenantId } from "../../value-objects/tenant-id.js";

export class NotificationSent extends DomainEvent {
  readonly eventName = "notification.sent";
  constructor(public readonly tenantId: TenantId, public readonly notificationId: string, public readonly recipientId: string) {
    super();
  }
}
