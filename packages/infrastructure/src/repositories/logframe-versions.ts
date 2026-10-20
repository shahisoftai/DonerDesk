import type { PrismaClient } from "@prisma/client";
import type { DomainError, Result, TenantId } from "@donordesk/domain";
import type { ILogframeVersionRepository, LogframeVersionRecord } from "@donordesk/application";

type Row = {
  id: string; tenantId: string; projectId: string; version: number; snapshotJson: string; contentHash: string; summary: string;
  createdById: string; createdAt: Date; approvedById: string | null; approvedAt: Date | null;
};

function ok<T>(value: T): Result<T, DomainError> {
  return { ok: true, value };
}

const toRecord = (r: Row): LogframeVersionRecord => ({ ...r });

export class PrismaLogframeVersionRepository implements ILogframeVersionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(record: LogframeVersionRecord): Promise<Result<LogframeVersionRecord, DomainError>> {
    await this.prisma.logframeVersion.create({
      data: {
        id: record.id, tenantId: record.tenantId, projectId: record.projectId, version: record.version, snapshotJson: record.snapshotJson,
        contentHash: record.contentHash, summary: record.summary, createdById: record.createdById, createdAt: record.createdAt,
      },
    });
    return ok(record);
  }

  async latest(projectId: string, tenantId: TenantId): Promise<Result<LogframeVersionRecord | null, DomainError>> {
    const row = await this.prisma.logframeVersion.findFirst({ where: { projectId, tenantId: tenantId.toString() }, orderBy: { version: "desc" } });
    return ok(row ? toRecord(row) : null);
  }

  async list(projectId: string, tenantId: TenantId): Promise<Result<LogframeVersionRecord[], DomainError>> {
    const rows = await this.prisma.logframeVersion.findMany({ where: { projectId, tenantId: tenantId.toString() }, orderBy: { version: "desc" }, take: 500 });
    return ok(rows.map(toRecord));
  }

  async findByNumber(projectId: string, version: number, tenantId: TenantId): Promise<Result<LogframeVersionRecord | null, DomainError>> {
    const row = await this.prisma.logframeVersion.findFirst({ where: { projectId, version, tenantId: tenantId.toString() } });
    return ok(row ? toRecord(row) : null);
  }

  async approve(id: string, userId: string, at: Date): Promise<Result<void, DomainError>> {
    await this.prisma.logframeVersion.update({ where: { id }, data: { approvedById: userId, approvedAt: at } });
    return ok(undefined);
  }
}
