import { TenantId, canvasFromColumns, documentOf, ok, type ExportFormatId, type Result } from "@donordesk/domain";
import type { ICanvasAiSetting, ICanvasExportRepository, ICanvasShareLinkRepository, ICanvasVersionRepository, ShareLinkKind, StoredCanvasExport, StoredCanvasShareLink, StoredCanvasVersion } from "@donordesk/application";
import type { PrismaClient } from "@prisma/client";

const exportOf = (r: NonNullable<Awaited<ReturnType<PrismaClient["canvasExport"]["findFirst"]>>>): StoredCanvasExport => ({
  id: r.id, tenantId: TenantId.create(r.tenantId), canvasId: r.canvasId, format: r.format as ExportFormatId, storageKey: r.storageKey, sizeBytes: r.sizeBytes,
  snapshotJson: r.snapshotJson, provenanceJson: r.provenanceJson, createdById: r.createdById, createdAt: r.createdAt,
});

/** Published copies are immutable: there is no update. */
export class PrismaCanvasExportRepository implements ICanvasExportRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async create(e: StoredCanvasExport): Promise<Result<void>> {
    await this.prisma.canvasExport.create({ data: { id: e.id, tenantId: e.tenantId.toString(), canvasId: e.canvasId, format: e.format, storageKey: e.storageKey, sizeBytes: e.sizeBytes, snapshotJson: e.snapshotJson, provenanceJson: e.provenanceJson, createdById: e.createdById } });
    return ok(undefined);
  }
  async findById(id: string, tenantId: TenantId): Promise<Result<StoredCanvasExport | null>> {
    const r = await this.prisma.canvasExport.findFirst({ where: { id, tenantId: tenantId.toString() } });
    return ok(r ? exportOf(r) : null);
  }
  async listByCanvas(canvasId: string, tenantId: TenantId): Promise<Result<StoredCanvasExport[]>> {
    const rows = await this.prisma.canvasExport.findMany({ where: { canvasId, tenantId: tenantId.toString() }, orderBy: { createdAt: "desc" }, take: 50 });
    return ok(rows.map(exportOf));
  }
}

const linkOf = (r: NonNullable<Awaited<ReturnType<PrismaClient["canvasShareLink"]["findFirst"]>>>): StoredCanvasShareLink => ({
  id: r.id, tenantId: TenantId.create(r.tenantId), canvasId: r.canvasId, kind: r.kind as ShareLinkKind, ...(r.exportId ? { exportId: r.exportId } : {}), label: r.label, tokenHash: r.tokenHash,
  expiresAt: r.expiresAt, ...(r.revokedAt ? { revokedAt: r.revokedAt } : {}), createdById: r.createdById, createdAt: r.createdAt,
});

export class PrismaCanvasShareLinkRepository implements ICanvasShareLinkRepository {
  /** `admin` reads across organisations: a public link holder does not yet know the tenant. */
  constructor(private readonly prisma: PrismaClient, private readonly admin?: PrismaClient) {}
  async create(l: StoredCanvasShareLink): Promise<Result<void>> {
    await this.prisma.canvasShareLink.create({ data: { id: l.id, tenantId: l.tenantId.toString(), canvasId: l.canvasId, kind: l.kind, exportId: l.exportId ?? null, label: l.label, tokenHash: l.tokenHash, expiresAt: l.expiresAt, createdById: l.createdById } });
    return ok(undefined);
  }
  async listByCanvas(canvasId: string, tenantId: TenantId): Promise<Result<StoredCanvasShareLink[]>> {
    const rows = await this.prisma.canvasShareLink.findMany({ where: { canvasId, tenantId: tenantId.toString() }, orderBy: { createdAt: "desc" } });
    return ok(rows.map(linkOf));
  }
  async findById(id: string, tenantId: TenantId): Promise<Result<StoredCanvasShareLink | null>> {
    const r = await this.prisma.canvasShareLink.findFirst({ where: { id, tenantId: tenantId.toString() } });
    return ok(r ? linkOf(r) : null);
  }
  async findByTokenHash(hash: string): Promise<Result<StoredCanvasShareLink | null>> {
    const r = await (this.admin ?? this.prisma).canvasShareLink.findFirst({ where: { tokenHash: hash } });
    return ok(r ? linkOf(r) : null);
  }
  async revoke(id: string, tenantId: TenantId, at: Date): Promise<Result<void>> {
    await this.prisma.canvasShareLink.updateMany({ where: { id, tenantId: tenantId.toString(), revokedAt: null }, data: { revokedAt: at } });
    return ok(undefined);
  }
}

export class PrismaCanvasVersionRepository implements ICanvasVersionRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async add(v: StoredCanvasVersion): Promise<Result<void>> {
    try {
      await this.prisma.canvasVersion.create({ data: { id: v.id, tenantId: v.tenantId.toString(), canvasId: v.canvasId, revision: v.revision, title: v.title, docJson: documentOf(v.canvas), savedById: v.savedById } });
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e; // that revision is already kept
    }
    return ok(undefined);
  }
  async list(canvasId: string, tenantId: TenantId, limit: number) {
    const rows = await this.prisma.canvasVersion.findMany({ where: { canvasId, tenantId: tenantId.toString() }, orderBy: { revision: "desc" }, take: limit });
    return ok(rows.map((r) => ({ id: r.id, tenantId: TenantId.create(r.tenantId), canvasId: r.canvasId, revision: r.revision, title: r.title, savedById: r.savedById, createdAt: r.createdAt })));
  }
  async find(canvasId: string, revision: number, tenantId: TenantId): Promise<Result<StoredCanvasVersion | null>> {
    const r = await this.prisma.canvasVersion.findFirst({ where: { canvasId, revision, tenantId: tenantId.toString() } });
    if (!r) return ok(null);
    const canvas = canvasFromColumns({ id: r.canvasId, scope: "MINE", mode: "LIVE", title: r.title, revision: r.revision, docJson: r.docJson });
    return ok(canvas ? { id: r.id, tenantId: TenantId.create(r.tenantId), canvasId: r.canvasId, revision: r.revision, title: r.title, canvas, savedById: r.savedById, createdAt: r.createdAt } : null);
  }
}

export class PrismaCanvasAiSetting implements ICanvasAiSetting {
  constructor(private readonly prisma: PrismaClient) {}
  async isEnabled(tenantId: TenantId): Promise<boolean> {
    const o = await this.prisma.organization.findFirst({ where: { tenantId: tenantId.toString() }, select: { aiEnabled: true, canvasAiEnabled: true } });
    return Boolean(o?.aiEnabled && o.canvasAiEnabled);
  }
  async set(tenantId: TenantId, enabled: boolean): Promise<Result<void>> {
    await this.prisma.organization.updateMany({ where: { tenantId: tenantId.toString() }, data: { canvasAiEnabled: enabled } });
    return ok(undefined);
  }
}
