import { DomainEvent } from "../../core/domain-event.js";
import { TenantId } from "../../value-objects/tenant-id.js";
import { UserId } from "../../value-objects/user-id.js";
import type { Role } from "./role.js";

export class UserInvited extends DomainEvent {
  readonly eventName = "identity.user.invited";
  constructor(
    public readonly tenantId: TenantId,
    public readonly invitationId: string,
    public readonly email: string,
    public readonly role: Role,
  ) {
    super();
  }
}

export class UserActivated extends DomainEvent {
  readonly eventName = "identity.user.activated";
  constructor(public readonly tenantId: TenantId, public readonly userId: UserId) {
    super();
  }
}

export class RoleChanged extends DomainEvent {
  readonly eventName = "identity.user.role_changed";
  constructor(
    public readonly tenantId: TenantId,
    public readonly userId: UserId,
    public readonly fromRole: Role,
    public readonly toRole: Role,
  ) {
    super();
  }
}
