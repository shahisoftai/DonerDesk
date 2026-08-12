import { Entity } from "../../core/entity.js";
import { TenantId } from "../../value-objects/tenant-id.js";

export class ProjectMember extends Entity<string> {
  private constructor(
    id: string,
    readonly tenantId: TenantId,
    readonly projectId: string,
    readonly userId: string,
    readonly addedAt: Date,
  ) {
    super(id, addedAt);
  }

  static create(input: { id: string; tenantId: TenantId; projectId: string; userId: string }): ProjectMember {
    return new ProjectMember(input.id, input.tenantId, input.projectId, input.userId, new Date());
  }
}
