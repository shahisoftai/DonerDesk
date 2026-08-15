import type { Result, TenantId } from "@donordesk/domain";

export interface CommentRecord {
  id: string;
  tenantId: string;
  entityType: string;
  entityId: string;
  commentText: string;
  authorId: string;
  mentionedUserId?: string;
  status: "OPEN" | "RESOLVED";
  createdAt: Date;
  updatedAt: Date;
}

export interface ICommentRepository {
  create(c: CommentRecord): Promise<Result<CommentRecord>>;
  resolve(id: string, tenantId: TenantId): Promise<Result<CommentRecord>>;
  findById(id: string, tenantId: TenantId): Promise<Result<CommentRecord | null>>;
  findByEntity(entityType: string, entityId: string, tenantId: TenantId): Promise<Result<CommentRecord[]>>;
}

export interface INotificationRepository {
  create(input: {
    id: string;
    tenantId: string;
    recipientId: string;
    type: string;
    title: string;
    message: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
  }): Promise<Result<void>>;
  markRead(id: string, userId: string, tenantId: TenantId): Promise<Result<void>>;
  listForUser(userId: string, tenantId: TenantId): Promise<Result<Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    read: boolean;
    createdAt: Date;
    relatedEntityType?: string;
    relatedEntityId?: string;
  }>>>;
}

export interface IAuditRepository {
  create(input: {
    id: string;
    tenantId: string;
    actorId: string;
    eventType: string;
    entityType: string;
    entityId: string;
    projectId?: string;
    oldValue?: string;
    newValue?: string;
    ipAddress?: string;
    systemNote?: string;
    prevHash?: string;
    hash?: string;
  }): Promise<Result<void>>;
  listByTenant(tenantId: TenantId, options?: { projectId?: string; limit?: number; offset?: number; eventType?: string; actorId?: string }): Promise<Result<Array<{
    id: string;
    actorId: string;
    eventType: string;
    entityType: string;
    entityId: string;
    projectId?: string;
    oldValue?: string;
    newValue?: string;
    ipAddress?: string;
    systemNote?: string;
    prevHash?: string;
    hash?: string;
    createdAt: Date;
  }>>>;
}
