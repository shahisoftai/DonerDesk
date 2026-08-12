import { PrismaClient, type Prisma } from "@prisma/client";
import type { IAuditRepository, IAuditLogger, ICommentRepository, INotificationRepository, CommentRecord } from "@donordesk/application";
import { DomainError, type Result, type TenantId } from "@donordesk/domain";
import { computeAuditHash, resolveAuditChainKey } from "../audit/chain.js";

function ok<T>(value: T): Result<T, DomainError> {
  return { ok: true, value };
}

function err<T = never>(e: DomainError): Result<T, DomainError> {
  return { ok: false, error: e };
}

export class PrismaCommentRepository implements ICommentRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async create(c: CommentRecord): Promise<Result<CommentRecord, DomainError>> {
    await this.prisma.comment.create({
      data: {
        id: c.id,
        tenantId: c.tenantId,
        entityType: c.entityType,
        entityId: c.entityId,
        commentText: c.commentText,
        authorId: c.authorId,
        mentionedUserId: c.mentionedUserId,
        status: c.status,
      },
    });
    return ok(c);
  }
  async resolve(id: string, tenantId: TenantId): Promise<Result<CommentRecord, DomainError>> {
    await this.prisma.comment.updateMany({ where: { id, tenantId: tenantId.toString() }, data: { status: "RESOLVED" } });
    const row = await this.prisma.comment.findFirst({ where: { id, tenantId: tenantId.toString() } });
    if (!row) return err(DomainError.notFound("Comment", id));
    return ok({
      id: row.id,
      tenantId: row.tenantId,
      entityType: row.entityType,
      entityId: row.entityId,
      commentText: row.commentText,
      authorId: row.authorId,
      mentionedUserId: row.mentionedUserId ?? undefined,
      status: row.status as "OPEN" | "RESOLVED",
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
  async findById(id: string, tenantId: TenantId): Promise<Result<CommentRecord | null, DomainError>> {
    const row = await this.prisma.comment.findFirst({ where: { id, tenantId: tenantId.toString() } });
    if (!row) return ok(null);
    return ok({
      id: row.id,
      tenantId: row.tenantId,
      entityType: row.entityType,
      entityId: row.entityId,
      commentText: row.commentText,
      authorId: row.authorId,
      mentionedUserId: row.mentionedUserId ?? undefined,
      status: row.status as "OPEN" | "RESOLVED",
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
  async findByEntity(entityType: string, entityId: string, tenantId: TenantId): Promise<Result<CommentRecord[], DomainError>> {
    const rows = await this.prisma.comment.findMany({ where: { entityType, entityId, tenantId: tenantId.toString() }, orderBy: { createdAt: "asc" } });
    return ok(rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      entityType: row.entityType,
      entityId: row.entityId,
      commentText: row.commentText,
      authorId: row.authorId,
      mentionedUserId: row.mentionedUserId ?? undefined,
      status: row.status as "OPEN" | "RESOLVED",
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })));
  }
}

export class PrismaNotificationRepository implements INotificationRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async create(input: { id: string; tenantId: string; recipientId: string; type: string; title: string; message: string; relatedEntityType?: string; relatedEntityId?: string; }): Promise<Result<void, DomainError>> {
    await this.prisma.notification.create({
      data: {
        id: input.id,
        tenantId: input.tenantId,
        recipientId: input.recipientId,
        type: input.type,
        title: input.title,
        message: input.message,
        relatedEntityType: input.relatedEntityType,
        relatedEntityId: input.relatedEntityId,
      },
    });
    return ok(undefined);
  }
  async markRead(id: string, userId: string, tenantId: TenantId): Promise<Result<void, DomainError>> {
    const updated = await this.prisma.notification.updateMany({
      where: { id, recipientId: userId, tenantId: tenantId.toString() },
      data: { read: true },
    });
    if (updated.count === 0) return err(DomainError.notFound("Notification", id));
    return ok(undefined);
  }
  async listForUser(userId: string, tenantId: TenantId): Promise<Result<Array<{ id: string; type: string; title: string; message: string; read: boolean; createdAt: Date; relatedEntityType?: string; relatedEntityId?: string }>, DomainError>> {
    const rows = await this.prisma.notification.findMany({ where: { recipientId: userId, tenantId: tenantId.toString() }, orderBy: { createdAt: "desc" }, take: 100 });
    return ok(rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      message: r.message,
      read: r.read,
      createdAt: r.createdAt,
      relatedEntityType: r.relatedEntityType ?? undefined,
      relatedEntityId: r.relatedEntityId ?? undefined,
    })));
  }
}

export class PrismaAuditRepository implements IAuditRepository, IAuditLogger {
  private readonly chainKey: string;

  constructor(private readonly prisma: PrismaClient, chainKey = resolveAuditChainKey()) {
    this.chainKey = chainKey;
  }

  private async getChainHead(tx: Prisma.TransactionClient, tenantId: string): Promise<{ hash: string; createdAt?: Date }> {
    const last = await tx.auditEvent.findFirst({
      where: { tenantId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { hash: true, createdAt: true },
    });
    return last ? { hash: last.hash, createdAt: last.createdAt } : { hash: "GENESIS" };
  }

  async record(input: Parameters<IAuditLogger["record"]>[0]): Promise<void> {
    const tenantIdStr = input.tenantId.toString();
    const id = crypto.randomUUID();
    await this.append({ ...input, id, tenantId: tenantIdStr });
  }

  async create(input: { id: string; tenantId: string; actorId: string; eventType: string; entityType: string; entityId: string; projectId?: string; oldValue?: string; newValue?: string; ipAddress?: string; systemNote?: string; }): Promise<Result<void, DomainError>> {
    await this.append(input);
    return ok(undefined);
  }

  private async append(input: { id: string; tenantId: string; actorId: string; eventType: string; entityType: string; entityId: string; projectId?: string; oldValue?: string; newValue?: string; ipAddress?: string; systemNote?: string }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.tenantId}, 0))`;
      const head = await this.getChainHead(tx, input.tenantId);
      const prevHash = head.hash;
      const createdAt = new Date(Math.max(Date.now(), (head.createdAt?.getTime() ?? 0) + 1));
      const hash = computeAuditHash({ ...input, createdAt, prevHash }, this.chainKey);
      await tx.auditEvent.create({ data: { ...input, prevHash, hash, createdAt } });
    });
  }

  async listByTenant(tenantId: TenantId, options?: { projectId?: string; limit?: number; offset?: number }): Promise<Result<Array<{ id: string; actorId: string; eventType: string; entityType: string; entityId: string; projectId?: string; oldValue?: string; newValue?: string; ipAddress?: string; systemNote?: string; prevHash: string; hash: string; createdAt: Date }>, DomainError>> {
    const rows = await this.prisma.auditEvent.findMany({
      where: { tenantId: tenantId.toString(), ...(options?.projectId ? { projectId: options.projectId } : {}) },
      orderBy: { createdAt: "desc" },
      take: options?.limit ?? 100,
      skip: options?.offset ?? 0,
    });
    return ok(rows.map((r) => ({
      id: r.id,
      actorId: r.actorId,
      eventType: r.eventType,
      entityType: r.entityType,
      entityId: r.entityId,
      projectId: r.projectId ?? undefined,
      oldValue: r.oldValue ?? undefined,
      newValue: r.newValue ?? undefined,
      ipAddress: r.ipAddress ?? undefined,
      systemNote: r.systemNote ?? undefined,
      prevHash: r.prevHash,
      hash: r.hash,
      createdAt: r.createdAt,
    })));
  }

  async verifyChain(tenantId: TenantId): Promise<{ valid: boolean; brokenAt?: string }> {
    const rows = await this.prisma.auditEvent.findMany({
      where: { tenantId: tenantId.toString() },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, tenantId: true, actorId: true, eventType: true, entityType: true, entityId: true, projectId: true, oldValue: true, newValue: true, ipAddress: true, systemNote: true, createdAt: true, prevHash: true, hash: true },
    });
    if (rows.length === 0) return { valid: true };
    let expectedPrevHash = "GENESIS";
    for (const row of rows) {
      if (row.prevHash !== expectedPrevHash) {
        return { valid: false, brokenAt: row.id };
      }
      const expectedHash = computeAuditHash({
        id: row.id,
        tenantId: row.tenantId,
        actorId: row.actorId,
        eventType: row.eventType,
        entityType: row.entityType,
        entityId: row.entityId,
        projectId: row.projectId ?? undefined,
        oldValue: row.oldValue ?? undefined,
        newValue: row.newValue ?? undefined,
        ipAddress: row.ipAddress ?? undefined,
        systemNote: row.systemNote ?? undefined,
        createdAt: row.createdAt,
        prevHash: row.prevHash,
      }, this.chainKey);
      if (expectedHash !== row.hash) {
        return { valid: false, brokenAt: row.id };
      }
      expectedPrevHash = row.hash;
    }
    return { valid: true };
  }
}
