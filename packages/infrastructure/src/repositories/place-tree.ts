import { DomainError, err, ok, type PlaceLinkRecord, type PlaceLinkSource, type RecordPlaceKind, type Result, type TenantId } from "@donordesk/domain";
import type {
  IPlaceWordLinkRepository, IProjectAreaRepository, IRecordPlaceOwnerReader, IRecordPlaceRepository, RecordPlaceOwner, RecordPlaceRow, StoredPlaceWordLink, StoredProjectArea,
} from "@donordesk/application";
import type { PrismaClient } from "@prisma/client";

/** A project's footprint (Phase 56). */
export class PrismaProjectAreaRepository implements IProjectAreaRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(tenantId: TenantId, projectId: string): Promise<Result<StoredProjectArea[]>> {
    return ok(await this.prisma.projectArea.findMany({ where: { tenantId: tenantId.toString(), projectId }, orderBy: { createdAt: "asc" } }));
  }

  async listAll(tenantId: TenantId): Promise<Result<StoredProjectArea[]>> {
    return ok(await this.prisma.projectArea.findMany({ where: { tenantId: tenantId.toString() }, orderBy: { createdAt: "asc" } }));
  }

  async add(area: StoredProjectArea, replaces: readonly string[]): Promise<Result<void>> {
    await this.prisma.$transaction([
      ...(replaces.length ? [this.prisma.projectArea.deleteMany({ where: { tenantId: area.tenantId, projectId: area.projectId, placeId: { in: [...replaces] } } })] : []),
      this.prisma.projectArea.create({ data: { ...area } }),
    ]);
    return ok(undefined);
  }

  async remove(tenantId: TenantId, projectId: string, placeId: string): Promise<Result<void>> {
    const r = await this.prisma.projectArea.deleteMany({ where: { tenantId: tenantId.toString(), projectId, placeId } });
    return r.count === 1 ? ok(undefined) : err(DomainError.notFound("Project area", placeId));
  }

  /** Writes every mutable field; `?? null` so reopening clears the close. */
  async update(area: StoredProjectArea): Promise<Result<void>> {
    const r = await this.prisma.projectArea.updateMany({
      where: { tenantId: area.tenantId, projectId: area.projectId, placeId: area.placeId },
      data: { closedAt: area.closedAt ?? null, closedReason: area.closedReason ?? null },
    });
    return r.count === 1 ? ok(undefined) : err(DomainError.notFound("Project area", area.placeId));
  }
}

/** Which table holds each kind's links and which column names the record. The planned-activity table predates sources: every row reads as CHOSEN. */
interface LinkTable {
  findMany(args: unknown): Promise<Array<Record<string, unknown>>>;
  deleteMany(args: unknown): unknown;
  createMany(args: unknown): unknown;
  findFirst(args: unknown): Promise<Record<string, unknown> | null>;
  create(args: unknown): Promise<unknown>;
}
interface LinkTableSpec { table: (p: PrismaClient) => LinkTable; column: string; hasSource: boolean }

const LINK_TABLES: Readonly<Record<RecordPlaceKind, LinkTableSpec>> = {
  PLANNED_ACTIVITY: { table: (p) => p.plannedActivityPlace as unknown as LinkTable, column: "plannedActivityId", hasSource: false },
  ACTIVITY: { table: (p) => p.activityUpdatePlace as unknown as LinkTable, column: "activityUpdateId", hasSource: true },
  EVIDENCE: { table: (p) => p.evidencePlace as unknown as LinkTable, column: "evidenceFileId", hasSource: true },
  BENEFICIARY: { table: (p) => p.beneficiaryPlace as unknown as LinkTable, column: "beneficiaryId", hasSource: true },
};

const sourceOf = (spec: LinkTableSpec, row: Record<string, unknown>): PlaceLinkSource => (spec.hasSource && typeof row.source === "string" ? row.source as PlaceLinkSource : "CHOSEN");

/** Every kind's links behind one repository; the table is chosen from `LINK_TABLES`, never by branching on a kind. */
export class PrismaRecordPlaceRepository implements IRecordPlaceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async find(kind: RecordPlaceKind, recordId: string, tenantId: TenantId): Promise<Result<PlaceLinkRecord[]>> {
    const spec = LINK_TABLES[kind];
    const rows = await spec.table(this.prisma).findMany({ where: { tenantId: tenantId.toString(), [spec.column]: recordId }, orderBy: { createdAt: "asc" } });
    return ok(rows.map((r) => ({ placeId: String(r.placeId), source: sourceOf(spec, r) })));
  }

  async findFor(kind: RecordPlaceKind, recordIds: readonly string[], tenantId: TenantId): Promise<Result<Map<string, PlaceLinkRecord[]>>> {
    const out = new Map<string, PlaceLinkRecord[]>();
    if (recordIds.length === 0) return ok(out);
    const spec = LINK_TABLES[kind];
    const rows = await spec.table(this.prisma).findMany({ where: { tenantId: tenantId.toString(), [spec.column]: { in: [...recordIds] } }, orderBy: { createdAt: "asc" } });
    for (const r of rows) { const id = String(r[spec.column]); out.set(id, [...(out.get(id) ?? []), { placeId: String(r.placeId), source: sourceOf(spec, r) }]); }
    return ok(out);
  }

  async listByProject(kind: RecordPlaceKind, tenantId: TenantId, projectId?: string): Promise<Result<Array<RecordPlaceRow & { projectId: string }>>> {
    const spec = LINK_TABLES[kind];
    const rows = await spec.table(this.prisma).findMany({ where: { tenantId: tenantId.toString(), ...(projectId ? { projectId } : {}) } });
    return ok(rows.map((r) => ({ recordId: String(r[spec.column]), placeId: String(r.placeId), source: sourceOf(spec, r), projectId: String(r.projectId) })));
  }

  async replace(kind: RecordPlaceKind, input: { tenantId: string; projectId: string; recordId: string; links: readonly PlaceLinkRecord[]; userId: string; now: Date }): Promise<Result<void>> {
    const spec = LINK_TABLES[kind];
    const table = spec.table(this.prisma);
    // One timestamp per row, a millisecond apart, so the order the person chose is the order read back.
    await this.prisma.$transaction([
      table.deleteMany({ where: { tenantId: input.tenantId, [spec.column]: input.recordId } }),
      ...(input.links.length ? [table.createMany({
        data: input.links.map((l, i) => ({
          id: `${input.recordId}:${l.placeId}`, tenantId: input.tenantId, projectId: input.projectId, [spec.column]: input.recordId, placeId: l.placeId,
          ...(spec.hasSource ? { source: l.source } : {}), createdById: input.userId, createdAt: new Date(input.now.getTime() + i),
        })),
      })] : []),
    ] as never);
    return ok(undefined);
  }

  async addIfMissing(kind: RecordPlaceKind, input: { tenantId: string; projectId: string; recordId: string; placeId: string; source: PlaceLinkSource; userId: string; now: Date }): Promise<Result<boolean>> {
    const spec = LINK_TABLES[kind];
    const table = spec.table(this.prisma);
    const found = await table.findFirst({ where: { tenantId: input.tenantId, [spec.column]: input.recordId, placeId: input.placeId } });
    if (found) return ok(false);
    await table.create({ data: { id: `${input.recordId}:${input.placeId}`, tenantId: input.tenantId, projectId: input.projectId, [spec.column]: input.recordId, placeId: input.placeId, ...(spec.hasSource ? { source: input.source } : {}), createdById: input.userId, createdAt: input.now } });
    return ok(true);
  }
}

/** What a record is (its project, the parent it inherits from, the words typed for its location), one small read per kind. */
export class PrismaRecordPlaceOwnerReader implements IRecordPlaceOwnerReader {
  constructor(private readonly prisma: PrismaClient) {}

  private readonly readers: Readonly<Record<RecordPlaceKind, (tenantId: string, id: string) => Promise<RecordPlaceOwner | null>>> = {
    PLANNED_ACTIVITY: async (t, id) => { const r = await this.prisma.plannedActivity.findFirst({ where: { tenantId: t, id }, select: { projectId: true, location: true } }); return r ? { projectId: r.projectId, parentId: null, typed: r.location } : null; },
    ACTIVITY: async (t, id) => { const r = await this.prisma.activityUpdate.findFirst({ where: { tenantId: t, id }, select: { projectId: true, plannedActivityId: true, location: true } }); return r ? { projectId: r.projectId, parentId: r.plannedActivityId, typed: r.location } : null; },
    EVIDENCE: async (t, id) => { const r = await this.prisma.evidenceFile.findFirst({ where: { tenantId: t, id }, select: { projectId: true, activityId: true, location: true } }); return r ? { projectId: r.projectId, parentId: r.activityId, typed: r.location } : null; },
    BENEFICIARY: async (t, id) => { const r = await this.prisma.beneficiary.findFirst({ where: { tenantId: t, id }, select: { projectId: true, location: true } }); return r ? { projectId: r.projectId, parentId: null, typed: r.location || null } : null; },
  };

  async ownerOf(kind: RecordPlaceKind, recordId: string, tenantId: TenantId): Promise<Result<RecordPlaceOwner | null>> {
    return ok(await this.readers[kind](tenantId.toString(), recordId));
  }
}

export class PrismaPlaceWordLinkRepository implements IPlaceWordLinkRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(tenantId: TenantId, projectId: string): Promise<Result<StoredPlaceWordLink[]>> {
    return ok(await this.prisma.placeWordLink.findMany({ where: { tenantId: tenantId.toString(), projectId } }));
  }

  async upsert(link: StoredPlaceWordLink): Promise<Result<void>> {
    await this.prisma.placeWordLink.upsert({
      where: { projectId_word: { projectId: link.projectId, word: link.word } },
      create: { ...link },
      update: { placeId: link.placeId, confirmedById: link.confirmedById, confirmedAt: link.confirmedAt },
    });
    return ok(undefined);
  }
}
