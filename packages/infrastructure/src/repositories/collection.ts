import { TenantId, ok, type FormDefinition, type RecordMapping, type Result } from "@donordesk/domain";
import type {
  CollectionRecordStatus, ICollectionFileRepository, StoredCollectionFile, ICollectionFormRepository, ICollectionLinkRepository, ICollectionRecordRepository,
  StoredCollectionForm, StoredCollectionLink, StoredCollectionRecord,
} from "@donordesk/application";
import type { PrismaClient } from "@prisma/client";

const json = <T>(text: string, fallback: T): T => {
  try { return JSON.parse(text) as T; } catch { return fallback; }
};

type FormRow = NonNullable<Awaited<ReturnType<PrismaClient["collectionForm"]["findFirst"]>>>;
type RecordRow = NonNullable<Awaited<ReturnType<PrismaClient["collectionRecord"]["findFirst"]>>>;
type LinkRow = NonNullable<Awaited<ReturnType<PrismaClient["collectionLink"]["findFirst"]>>>;

const formFrom = (r: FormRow): StoredCollectionForm => ({
  id: r.id, tenantId: TenantId.create(r.tenantId), projectId: r.projectId, name: r.name, ...(r.description ? { description: r.description } : {}),
  definition: json<FormDefinition>(r.definitionJson, { fields: [] }), mappings: json<RecordMapping[]>(r.mappingsJson, []),
  status: r.status as StoredCollectionForm["status"], createdById: r.createdById, createdAt: r.createdAt, updatedAt: r.updatedAt,
});

const recordFrom = (r: RecordRow): StoredCollectionRecord => ({
  id: r.id, tenantId: TenantId.create(r.tenantId), formId: r.formId, projectId: r.projectId, answers: json<Record<string, unknown>>(r.answersJson, {}),
  submittedOn: r.submittedOn, source: r.source === "LINK" ? "LINK" : r.source === "CONNECTOR" ? "CONNECTOR" : "USER", ...(r.submittedById ? { submittedById: r.submittedById } : {}),
  ...(r.submitterName ? { submitterName: r.submitterName } : {}), status: r.status as CollectionRecordStatus, ...(r.reviewNote ? { reviewNote: r.reviewNote } : {}),
  ...(r.reviewedById ? { reviewedById: r.reviewedById } : {}), ...(r.reviewedAt ? { reviewedAt: r.reviewedAt } : {}), createdAt: r.createdAt,
});

const linkFrom = (r: LinkRow): StoredCollectionLink => ({
  id: r.id, tenantId: TenantId.create(r.tenantId), formId: r.formId, label: r.label, tokenHash: r.tokenHash, expiresAt: r.expiresAt,
  ...(r.revokedAt ? { revokedAt: r.revokedAt } : {}), createdById: r.createdById, createdAt: r.createdAt,
});

export class PrismaCollectionFormRepository implements ICollectionFormRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(f: StoredCollectionForm): Promise<Result<void>> {
    await this.prisma.collectionForm.create({
      data: {
        id: f.id, tenantId: f.tenantId.toString(), projectId: f.projectId, name: f.name, description: f.description ?? null,
        definitionJson: JSON.stringify(f.definition), mappingsJson: JSON.stringify(f.mappings), status: f.status, createdById: f.createdById,
      },
    });
    return ok(undefined);
  }

  /** Writes every mutable field; `?? null` so a cleared description is cleared (Prisma ignores `undefined`). */
  async update(f: StoredCollectionForm): Promise<Result<void>> {
    await this.prisma.collectionForm.updateMany({
      where: { id: f.id, tenantId: f.tenantId.toString() },
      data: { name: f.name, description: f.description ?? null, definitionJson: JSON.stringify(f.definition), mappingsJson: JSON.stringify(f.mappings), status: f.status },
    });
    return ok(undefined);
  }

  async findById(id: string, tenantId: TenantId): Promise<Result<StoredCollectionForm | null>> {
    const row = await this.prisma.collectionForm.findFirst({ where: { id, tenantId: tenantId.toString() } });
    return ok(row ? formFrom(row) : null);
  }

  async listByProject(projectId: string, tenantId: TenantId): Promise<Result<StoredCollectionForm[]>> {
    const rows = await this.prisma.collectionForm.findMany({ where: { projectId, tenantId: tenantId.toString() }, orderBy: { createdAt: "desc" } });
    return ok(rows.map(formFrom));
  }
}

export class PrismaCollectionRecordRepository implements ICollectionRecordRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createOnce(r: StoredCollectionRecord): Promise<Result<{ record: StoredCollectionRecord; created: boolean }>> {
    const tenantId = r.tenantId.toString();
    const existing = await this.prisma.collectionRecord.findFirst({ where: { id: r.id, tenantId } });
    // The client's own id is the idempotency key; an id that belongs to another form is a different submission, never a repeat.
    if (existing) return ok({ record: recordFrom(existing), created: false });
    try {
      await this.prisma.collectionRecord.create({
        data: {
          id: r.id, tenantId, formId: r.formId, projectId: r.projectId, answersJson: JSON.stringify(r.answers), submittedOn: r.submittedOn, source: r.source,
          submittedById: r.submittedById ?? null, submitterName: r.submitterName ?? null, status: r.status,
        },
      });
    } catch (e) {
      // A concurrent re-send created it between the read and the write: it is stored once.
      if ((e as { code?: string }).code === "P2002") {
        const again = await this.prisma.collectionRecord.findFirst({ where: { id: r.id, tenantId } });
        if (again) return ok({ record: recordFrom(again), created: false });
      }
      throw e;
    }
    return ok({ record: r, created: true });
  }

  async update(r: StoredCollectionRecord): Promise<Result<void>> {
    await this.prisma.collectionRecord.updateMany({
      where: { id: r.id, tenantId: r.tenantId.toString() },
      data: { status: r.status, reviewNote: r.reviewNote ?? null, reviewedById: r.reviewedById ?? null, reviewedAt: r.reviewedAt ?? null },
    });
    return ok(undefined);
  }

  async findById(id: string, tenantId: TenantId): Promise<Result<StoredCollectionRecord | null>> {
    const row = await this.prisma.collectionRecord.findFirst({ where: { id, tenantId: tenantId.toString() } });
    return ok(row ? recordFrom(row) : null);
  }

  async listByForm(formId: string, tenantId: TenantId, status?: CollectionRecordStatus): Promise<Result<StoredCollectionRecord[]>> {
    const rows = await this.prisma.collectionRecord.findMany({
      where: { formId, tenantId: tenantId.toString(), ...(status ? { status } : {}) }, orderBy: { createdAt: "desc" }, take: 5000,
    });
    return ok(rows.map(recordFrom));
  }

  async countByStatus(formId: string, tenantId: TenantId): Promise<Result<Record<CollectionRecordStatus, number>>> {
    const groups = await this.prisma.collectionRecord.groupBy({ by: ["status"], where: { formId, tenantId: tenantId.toString() }, _count: { _all: true } });
    const out: Record<CollectionRecordStatus, number> = { PENDING: 0, ACCEPTED: 0, REJECTED: 0 };
    for (const g of groups) if (g.status in out) out[g.status as CollectionRecordStatus] = g._count._all;
    return ok(out);
  }
}

export class PrismaCollectionLinkRepository implements ICollectionLinkRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(l: StoredCollectionLink): Promise<Result<void>> {
    await this.prisma.collectionLink.create({
      data: { id: l.id, tenantId: l.tenantId.toString(), formId: l.formId, label: l.label, tokenHash: l.tokenHash, expiresAt: l.expiresAt, createdById: l.createdById },
    });
    return ok(undefined);
  }

  async listByForm(formId: string, tenantId: TenantId): Promise<Result<StoredCollectionLink[]>> {
    const rows = await this.prisma.collectionLink.findMany({ where: { formId, tenantId: tenantId.toString() }, orderBy: { createdAt: "desc" } });
    return ok(rows.map(linkFrom));
  }

  async findById(id: string, tenantId: TenantId): Promise<Result<StoredCollectionLink | null>> {
    const row = await this.prisma.collectionLink.findFirst({ where: { id, tenantId: tenantId.toString() } });
    return ok(row ? linkFrom(row) : null);
  }

  async revoke(id: string, tenantId: TenantId, at: Date): Promise<Result<void>> {
    await this.prisma.collectionLink.updateMany({ where: { id, tenantId: tenantId.toString(), revokedAt: null }, data: { revokedAt: at } });
    return ok(undefined);
  }

  async findByTokenHash(tokenHash: string): Promise<Result<StoredCollectionLink | null>> {
    const row = await this.prisma.collectionLink.findUnique({ where: { tokenHash } });
    return ok(row ? linkFrom(row) : null);
  }
}

export class PrismaCollectionFileRepository implements ICollectionFileRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(f: StoredCollectionFile): Promise<Result<void>> {
    await this.prisma.collectionFile.create({
      data: {
        id: f.id, tenantId: f.tenantId.toString(), formId: f.formId, fileName: f.fileName, contentType: f.contentType, size: f.size,
        storageKey: f.storageKey, source: f.source, uploadedById: f.uploadedById ?? null,
      },
    });
    return ok(undefined);
  }

  async findById(id: string, tenantId: TenantId): Promise<Result<StoredCollectionFile | null>> {
    const r = await this.prisma.collectionFile.findFirst({ where: { id, tenantId: tenantId.toString() } });
    return ok(r ? {
      id: r.id, tenantId: TenantId.create(r.tenantId), formId: r.formId, fileName: r.fileName, contentType: r.contentType, size: r.size,
      storageKey: r.storageKey, source: r.source === "LINK" ? "LINK" : "USER", ...(r.uploadedById ? { uploadedById: r.uploadedById } : {}), createdAt: r.createdAt,
    } : null);
  }
}
