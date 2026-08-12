import * as Domain from "@donordesk/domain";

export function toUserId(id: string): Domain.UserId {
  return Domain.UserId.create(id);
}

export function toTenantId(id: string): Domain.TenantId {
  return Domain.TenantId.create(id);
}
