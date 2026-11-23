import { TenantId, ok, type Result } from "@donordesk/domain";
import type {
  AssignmentState, ICollectionAssignmentRepository, ICollectionDraftRepository, StoredCollectionAssignment, StoredCollectionDraft,
} from "@donordesk/application";
import type { PrismaClient } from "@prisma/client";

const json = <T>(text: string | null, fallback: T): T => {
  if (!text) return fallback;
  try { return JSON.parse(text) as T; } catch { return fallback; }
};

type DraftRow = NonNullable<Awaited<ReturnType<PrismaClient["collectionDraft"]["findFirst"]>>>;
type AssignmentRow = NonNullable<Awaited<ReturnType<PrismaClient["collectionAssignment"]["findFirst"]>>>;

const draftFrom = (r: DraftRow): StoredCollectionDraft => ({
  id: r.id, tenantId: TenantId.create(r.tenantId), formId: r.formId, projectId: r.projectId, userId: r.userId, placeKey: r.placeKey,
  answers: json<Record<string, unknown>>(r.answersJson, {}), ...(r.howJson ? { how: json<Record<string, string>>(r.howJson, {}) } : {}), startedAt: r.startedAt, createdAt: r.createdAt, updatedAt: r.updatedAt,
});

const assignmentFrom = (r: AssignmentRow): StoredCollectionAssignment => ({
  id: r.id, tenantId: TenantId.create(r.tenantId), formId: r.formId, projectId: r.projectId, placeId: r.placeId, assigneeId: r.assigneeId,
  ...(r.dueOn ? { dueOn: r.dueOn } : {}), status: r.status as AssignmentState, ...(r.reason ? { reason: r.reason } : {}), ...(r.recordId ? { recordId: r.recordId } : {}),
  createdById: r.createdById, createdAt: r.createdAt, updatedAt: r.updatedAt,
});

export class PrismaCollectionDraftRepository implements ICollectionDraftRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async find(formId: string, userId: string, placeKey: string, tenantId: TenantId): Promise<Result<StoredCollectionDraft | null>> {
    const row = await this.prisma.collectionDraft.findFirst({ where: { formId, userId, placeKey, tenantId: tenantId.toString() } });
    return ok(row ? draftFrom(row) : null);
  }

  async save(d: StoredCollectionDraft): Promise<Result<StoredCollectionDraft>> {
    const tenantId = d.tenantId.toString();
    const data = { answersJson: JSON.stringify(d.answers), howJson: d.how ? JSON.stringify(d.how) : null, projectId: d.projectId };
    const row = await this.prisma.collectionDraft.upsert({
      where: { tenantId_formId_userId_placeKey: { tenantId, formId: d.formId, userId: d.userId, placeKey: d.placeKey } },
      create: { id: d.id, tenantId, formId: d.formId, userId: d.userId, placeKey: d.placeKey, startedAt: d.startedAt, ...data },
      update: data,
    });
    return ok(draftFrom(row));
  }

  async delete(formId: string, userId: string, placeKey: string, tenantId: TenantId): Promise<Result<void>> {
    await this.prisma.collectionDraft.deleteMany({ where: { formId, userId, placeKey, tenantId: tenantId.toString() } });
    return ok(undefined);
  }

  async listForUser(userId: string, tenantId: TenantId): Promise<Result<StoredCollectionDraft[]>> {
    const rows = await this.prisma.collectionDraft.findMany({ where: { userId, tenantId: tenantId.toString() }, orderBy: { updatedAt: "desc" }, take: 200 });
    return ok(rows.map(draftFrom));
  }

  async listOlderThan(before: Date, tenantId: TenantId): Promise<Result<StoredCollectionDraft[]>> {
    const rows = await this.prisma.collectionDraft.findMany({ where: { tenantId: tenantId.toString(), updatedAt: { lt: before } }, take: 2000 });
    return ok(rows.map(draftFrom));
  }

  async deleteIds(ids: string[], tenantId: TenantId): Promise<Result<void>> {
    if (ids.length > 0) await this.prisma.collectionDraft.deleteMany({ where: { id: { in: ids }, tenantId: tenantId.toString() } });
    return ok(undefined);
  }
}

export class PrismaCollectionAssignmentRepository implements ICollectionAssignmentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsertMany(items: StoredCollectionAssignment[]): Promise<Result<void>> {
    // One transaction: a sheet of assignments is made all or not at all. A facility already done is never reopened here (the handler leaves it out).
    await this.prisma.$transaction(items.map((a) => this.prisma.collectionAssignment.upsert({
      where: { tenantId_formId_placeId: { tenantId: a.tenantId.toString(), formId: a.formId, placeId: a.placeId } },
      create: { id: a.id, tenantId: a.tenantId.toString(), formId: a.formId, projectId: a.projectId, placeId: a.placeId, assigneeId: a.assigneeId, dueOn: a.dueOn ?? null, status: a.status, createdById: a.createdById },
      update: { assigneeId: a.assigneeId, dueOn: a.dueOn ?? null },
    })));
    return ok(undefined);
  }

  async update(a: StoredCollectionAssignment): Promise<Result<void>> {
    // Every mutable field, `?? null`, so a cleared reason is cleared.
    await this.prisma.collectionAssignment.updateMany({
      where: { id: a.id, tenantId: a.tenantId.toString() },
      data: { assigneeId: a.assigneeId, dueOn: a.dueOn ?? null, status: a.status, reason: a.reason ?? null, recordId: a.recordId ?? null },
    });
    return ok(undefined);
  }

  async findById(id: string, tenantId: TenantId): Promise<Result<StoredCollectionAssignment | null>> {
    const row = await this.prisma.collectionAssignment.findFirst({ where: { id, tenantId: tenantId.toString() } });
    return ok(row ? assignmentFrom(row) : null);
  }

  async findByFormAndPlace(formId: string, placeId: string, tenantId: TenantId): Promise<Result<StoredCollectionAssignment | null>> {
    const row = await this.prisma.collectionAssignment.findFirst({ where: { formId, placeId, tenantId: tenantId.toString() } });
    return ok(row ? assignmentFrom(row) : null);
  }

  async listByForm(formId: string, tenantId: TenantId): Promise<Result<StoredCollectionAssignment[]>> {
    const rows = await this.prisma.collectionAssignment.findMany({ where: { formId, tenantId: tenantId.toString() }, orderBy: { createdAt: "asc" }, take: 2000 });
    return ok(rows.map(assignmentFrom));
  }

  async listForAssignee(assigneeId: string, tenantId: TenantId, statuses?: AssignmentState[]): Promise<Result<StoredCollectionAssignment[]>> {
    const rows = await this.prisma.collectionAssignment.findMany({ where: { assigneeId, tenantId: tenantId.toString(), ...(statuses ? { status: { in: statuses } } : {}) }, orderBy: { createdAt: "asc" }, take: 500 });
    return ok(rows.map(assignmentFrom));
  }
}
