import { TenantId, ok, type ColumnDef, type DatasetRowValues, type Result, type VersionStatus } from "@donordesk/domain";
import type { IDatasetCatalog, IDatasetLinkRepository, IDatasetRowStore, IDatasetSecretStore, StoredDataset, StoredDatasetLink, StoredDatasetVersion } from "@donordesk/application";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { EnvConnectorSecrets } from "../integrations/connector-adapters.js";

const json = <T>(text: string | null | undefined, fallback: T): T => { try { return text ? (JSON.parse(text) as T) : fallback; } catch { return fallback; } };
type DsRow = NonNullable<Awaited<ReturnType<PrismaClient["dataset"]["findFirst"]>>>;
type VRow = NonNullable<Awaited<ReturnType<PrismaClient["datasetVersion"]["findFirst"]>>>;

const datasetFrom = (r: DsRow): StoredDataset => {
  const connector = json<StoredDataset["connector"] | null>(r.connectorJson, null);
  return {
    id: r.id, tenantId: TenantId.create(r.tenantId), scope: r.scope === "ORGANISATION" ? "ORGANISATION" : "PROJECT", ...(r.projectId ? { projectId: r.projectId } : {}), name: r.name, description: r.description,
    ...(r.kitKey ? { kitKey: r.kitKey } : {}), kitMapping: json(r.kitMappingJson, {}), ...(r.currentVersionId ? { currentVersionId: r.currentVersionId } : {}),
    sharePolicy: json(r.sharePolicyJson, { hidden: [] }), restricted: r.restricted, ...(r.restrictionJson ? { restriction: json(r.restrictionJson, undefined) } : {}),
    ...(connector ? { connector } : {}), createdById: r.createdById, createdAt: r.createdAt, updatedAt: r.updatedAt,
  };
};

const versionFrom = (r: VRow): StoredDatasetVersion => ({
  id: r.id, tenantId: TenantId.create(r.tenantId), datasetId: r.datasetId, number: r.number, columns: json<ColumnDef[]>(r.columnsJson, []), steps: json(r.stepsJson, []),
  figures: json(r.figuresJson, []), checks: json(r.checksJson, []), rowCount: r.rowCount, ...(r.fileKey ? { fileKey: r.fileKey } : {}), ...(r.fileName ? { fileName: r.fileName } : {}),
  ...(r.fileHash ? { fileHash: r.fileHash } : {}), findings: json(r.findingsJson, []), summary: r.summary, status: r.status as VersionStatus,
  ...(r.decidedById ? { decidedById: r.decidedById } : {}), ...(r.decisionNote ? { decisionNote: r.decisionNote } : {}), createdById: r.createdById, createdAt: r.createdAt,
});

const mutable = (d: StoredDataset) => ({
  scope: d.scope, projectId: d.projectId ?? null, name: d.name, description: d.description, kitKey: d.kitKey ?? null, kitMappingJson: JSON.stringify(d.kitMapping),
  currentVersionId: d.currentVersionId ?? null, sharePolicyJson: JSON.stringify(d.sharePolicy), restricted: d.restricted, restrictionJson: d.restriction ? JSON.stringify(d.restriction) : null,
  connectorJson: d.connector ? JSON.stringify(d.connector) : null, updatedAt: d.updatedAt,
});

export class PrismaDatasetCatalog implements IDatasetCatalog {
  constructor(private readonly prisma: PrismaClient) {}
  async create(d: StoredDataset): Promise<Result<void>> { await this.prisma.dataset.create({ data: { id: d.id, tenantId: d.tenantId.toString(), createdById: d.createdById, createdAt: d.createdAt, ...mutable(d) } }); return ok(undefined); }
  /** Writes every mutable field (`?? null` so a cleared one is cleared). */
  async update(d: StoredDataset, expectedUpdatedAt?: Date): Promise<Result<boolean>> {
    const done = await this.prisma.dataset.updateMany({ where: { id: d.id, tenantId: d.tenantId.toString(), ...(expectedUpdatedAt ? { updatedAt: expectedUpdatedAt } : {}) }, data: mutable(d) });
    return ok(done.count > 0);
  }
  async findById(id: string, tenantId: TenantId): Promise<Result<StoredDataset | null>> { const r = await this.prisma.dataset.findFirst({ where: { id, tenantId: tenantId.toString() } }); return ok(r ? datasetFrom(r) : null); }
  async list(tenantId: TenantId, projectIds: readonly string[]): Promise<Result<StoredDataset[]>> {
    const rows = await this.prisma.dataset.findMany({ where: { tenantId: tenantId.toString(), OR: [{ scope: "ORGANISATION" }, { projectId: { in: [...projectIds] } }] }, orderBy: { updatedAt: "desc" } });
    return ok(rows.map(datasetFrom));
  }
  async listWithConnector(): Promise<Result<StoredDataset[]>> { const rows = await this.prisma.dataset.findMany({ where: { connectorJson: { not: null } } }); return ok(rows.map(datasetFrom)); }
  async delete(id: string, tenantId: TenantId): Promise<Result<void>> {
    await this.prisma.datasetIndicatorLink.deleteMany({ where: { datasetId: id, tenantId: tenantId.toString() } });
    await this.prisma.dataset.deleteMany({ where: { id, tenantId: tenantId.toString() } });
    return ok(undefined);
  }
  async createVersion(v: StoredDatasetVersion): Promise<Result<void>> {
    await this.prisma.datasetVersion.create({ data: {
      id: v.id, tenantId: v.tenantId.toString(), datasetId: v.datasetId, number: v.number, columnsJson: JSON.stringify(v.columns), stepsJson: JSON.stringify(v.steps), figuresJson: JSON.stringify(v.figures),
      checksJson: JSON.stringify(v.checks), rowCount: v.rowCount, fileKey: v.fileKey ?? null, fileName: v.fileName ?? null, fileHash: v.fileHash ?? null, findingsJson: JSON.stringify(v.findings.slice(0, 500)),
      summary: v.summary, status: v.status, decidedById: v.decidedById ?? null, decisionNote: v.decisionNote ?? null, createdById: v.createdById, createdAt: v.createdAt,
    } });
    return ok(undefined);
  }
  async findVersion(id: string, tenantId: TenantId): Promise<Result<StoredDatasetVersion | null>> { const r = await this.prisma.datasetVersion.findFirst({ where: { id, tenantId: tenantId.toString() } }); return ok(r ? versionFrom(r) : null); }
  async listVersions(datasetId: string, tenantId: TenantId): Promise<Result<StoredDatasetVersion[]>> { const rows = await this.prisma.datasetVersion.findMany({ where: { datasetId, tenantId: tenantId.toString() }, orderBy: { number: "desc" } }); return ok(rows.map(versionFrom)); }
  async decideVersion(id: string, tenantId: TenantId, status: VersionStatus, decidedById: string, note?: string): Promise<Result<void>> {
    await this.prisma.datasetVersion.updateMany({ where: { id, tenantId: tenantId.toString(), status: "PENDING" }, data: { status, decidedById, decisionNote: note ?? null } });
    return ok(undefined);
  }
  async deleteVersion(id: string, tenantId: TenantId): Promise<Result<void>> { await this.prisma.datasetVersion.deleteMany({ where: { id, tenantId: tenantId.toString() } }); return ok(undefined); }
}

const CHUNK = 2000;

/** Rows as jsonb, written in chunks; a version's rows are written once. Reads come back in sheet order. */
export class PrismaDatasetRowStore implements IDatasetRowStore {
  constructor(private readonly prisma: PrismaClient) {}
  async write(tenantId: TenantId, versionId: string, rows: readonly DatasetRowValues[]): Promise<Result<void>> {
    for (let i = 0; i < rows.length; i += CHUNK) {
      await this.prisma.datasetRow.createMany({ data: rows.slice(i, i + CHUNK).map((r) => ({ tenantId: tenantId.toString(), versionId, rowNo: r.rowNo, placeId: r.placeId ?? null, periodKey: r.periodKey ?? null, valuesJson: r.values as Prisma.InputJsonValue })) });
    }
    return ok(undefined);
  }
  async read(tenantId: TenantId, versionId: string): Promise<Result<DatasetRowValues[]>> {
    const out: DatasetRowValues[] = [];
    let after = -1;
    for (;;) {
      const page = await this.prisma.datasetRow.findMany({ where: { versionId, tenantId: tenantId.toString(), rowNo: { gt: after } }, orderBy: { rowNo: "asc" }, take: 10000 });
      for (const r of page) out.push({ rowNo: r.rowNo, values: r.valuesJson as DatasetRowValues["values"], ...(r.placeId ? { placeId: r.placeId } : {}), ...(r.periodKey ? { periodKey: r.periodKey } : {}) });
      if (page.length < 10000) break;
      after = page[page.length - 1]!.rowNo;
    }
    return ok(out);
  }
  async remove(tenantId: TenantId, versionId: string): Promise<Result<void>> { await this.prisma.datasetRow.deleteMany({ where: { versionId, tenantId: tenantId.toString() } }); return ok(undefined); }
}

type LRow = NonNullable<Awaited<ReturnType<PrismaClient["datasetIndicatorLink"]["findFirst"]>>>;
const linkFrom = (r: LRow): StoredDatasetLink => ({ id: r.id, tenantId: TenantId.create(r.tenantId), datasetId: r.datasetId, indicatorId: r.indicatorId, figureRef: r.figureRef, filters: json(r.filterJson, []), byPlace: r.byPlace, ...(r.lastSyncJson ? { lastSync: json(r.lastSyncJson, undefined) } : {}), createdById: r.createdById, createdAt: r.createdAt });

export class PrismaDatasetLinkRepository implements IDatasetLinkRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async create(l: StoredDatasetLink): Promise<Result<void>> { await this.prisma.datasetIndicatorLink.create({ data: { id: l.id, tenantId: l.tenantId.toString(), datasetId: l.datasetId, indicatorId: l.indicatorId, figureRef: l.figureRef, filterJson: JSON.stringify(l.filters), byPlace: l.byPlace, createdById: l.createdById, createdAt: l.createdAt } }); return ok(undefined); }
  async listForDataset(datasetId: string, tenantId: TenantId): Promise<Result<StoredDatasetLink[]>> { return ok((await this.prisma.datasetIndicatorLink.findMany({ where: { datasetId, tenantId: tenantId.toString() }, orderBy: { createdAt: "asc" } })).map(linkFrom)); }
  async listForIndicator(indicatorId: string, tenantId: TenantId): Promise<Result<StoredDatasetLink[]>> { return ok((await this.prisma.datasetIndicatorLink.findMany({ where: { indicatorId, tenantId: tenantId.toString() } })).map(linkFrom)); }
  async setLastSync(id: string, tenantId: TenantId, sync: NonNullable<StoredDatasetLink["lastSync"]>): Promise<Result<void>> { await this.prisma.datasetIndicatorLink.updateMany({ where: { id, tenantId: tenantId.toString() }, data: { lastSyncJson: JSON.stringify(sync) } }); return ok(undefined); }
  async delete(id: string, tenantId: TenantId): Promise<Result<void>> { await this.prisma.datasetIndicatorLink.deleteMany({ where: { id, tenantId: tenantId.toString() } }); return ok(undefined); }
}

/** The dataset connector's key, sealed with the same AES-256-GCM key as the form connectors (`CONNECTOR_SECRET_KEY`). */
export class PrismaDatasetSecretStore implements IDatasetSecretStore {
  constructor(private readonly prisma: PrismaClient, private readonly cipher: EnvConnectorSecrets) {}
  available(): boolean { return this.cipher.available; }
  seal(plain: string): string { return this.cipher.encrypt(plain); }
  open(sealed: string): string | undefined { try { return this.cipher.decrypt(sealed); } catch { return undefined; } }
  async read(datasetId: string, tenantId: TenantId): Promise<Result<string | null>> { const r = await this.prisma.dataset.findFirst({ where: { id: datasetId, tenantId: tenantId.toString() }, select: { connectorSecretEnc: true } }); return ok(r?.connectorSecretEnc ?? null); }
  async write(datasetId: string, tenantId: TenantId, sealed: string | null): Promise<Result<void>> { await this.prisma.dataset.updateMany({ where: { id: datasetId, tenantId: tenantId.toString() }, data: { connectorSecretEnc: sealed } }); return ok(undefined); }
}
