import { DomainError, KITS, canManageDataset, describeFigure, describeSteps, kitOf, kitTemplate, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IDatasetLinkRepository, StoredDataset, StoredDatasetLink, StoredDatasetVersion } from "../../ports/datasets.js";
import { can, fail, loadDataset, ok, viewerOf, visibleIds, type DatasetDeps } from "./dataset-shared.js";

export interface DatasetListItem { id: string; name: string; description: string; scope: string; projectId?: string | undefined; kitKey?: string | undefined; rowCount: number; columns: number; updatedAt: string; canManage: boolean; restricted: boolean; pending: number; connector?: string | undefined }

const listItem = (d: StoredDataset, v: StoredDatasetVersion | undefined, pending: number, ctx: AuthenticatedContext): DatasetListItem => ({
  id: d.id, name: d.name, description: d.description, scope: d.scope, ...(d.projectId ? { projectId: d.projectId } : {}), ...(d.kitKey ? { kitKey: d.kitKey } : {}),
  rowCount: v?.rowCount ?? 0, columns: v?.columns.length ?? 0, updatedAt: d.updatedAt.toISOString(), canManage: canManageDataset(d, viewerOf(ctx)), restricted: d.restricted, pending, ...(d.connector ? { connector: d.connector.kind } : {}),
});

/** The datasets the person can see: the organisation's and those of the projects they can see (one project with `projectId`). */
export class ListDatasetsHandler {
  constructor(private readonly deps: DatasetDeps) {}
  async handle(ctx: AuthenticatedContext, projectId?: string): Promise<Result<{ datasets: DatasetListItem[]; canCreate: boolean; canCreateOrg: boolean }, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot see datasets"));
    const ids = await visibleIds(this.deps, ctx);
    if (!ids.ok) return ids;
    if (projectId && !ids.value.has(projectId)) return fail(DomainError.notFound("Project", projectId));
    const listed = await this.deps.catalog.list(ctx.tenant.tenantId, projectId ? [projectId] : [...ids.value]);
    if (!listed.ok) return listed;
    const visible = listed.value.filter((d) => (projectId ? d.projectId === projectId || d.scope === "ORGANISATION" : true)).filter((d) => !d.restricted || d.createdById === ctx.tenant.userId || d.restriction?.viewerIds.includes(ctx.tenant.userId));
    const out: DatasetListItem[] = [];
    for (const d of visible) {
      const versions = await this.deps.catalog.listVersions(d.id, ctx.tenant.tenantId);
      const list = versions.ok ? versions.value : [];
      out.push(listItem(d, list.find((v) => v.id === d.currentVersionId), list.filter((v) => v.status === "PENDING").length, ctx));
    }
    return ok({ datasets: out, canCreate: can(ctx, "dataset.manage"), canCreateOrg: can(ctx, "org.manage") });
  }
}

export interface DatasetDetail extends DatasetListItem {
  columns: never;
  current?: { id: string; number: number; columns: StoredDatasetVersion["columns"]; figures: Array<StoredDatasetVersion["figures"][number] & { sentence: string }>; checks: StoredDatasetVersion["checks"]; steps: string[]; rawSteps: StoredDatasetVersion["steps"]; findings: StoredDatasetVersion["findings"]; rowCount: number; summary: string; createdAt: string } | undefined;
  versions: Array<{ id: string; number: number; status: string; rowCount: number; summary: string; createdAt: string; mine: boolean; decisionNote?: string | undefined }>;
  links: Array<{ id: string; indicatorId: string; figureRef: string; byPlace: boolean; lastSync?: StoredDatasetLink["lastSync"] }>;
  sharePolicy: StoredDataset["sharePolicy"];
  restriction?: StoredDataset["restriction"] | undefined;
  kit?: { key: string; title: string; reviewState: string; source: string; mapping: Record<string, string> } | undefined;
  connectorConfig?: Record<string, unknown> | undefined;
  lastPull?: { at?: string | undefined; summary?: string | undefined } | undefined;
}

export class GetDatasetHandler {
  constructor(private readonly deps: DatasetDeps, private readonly links: IDatasetLinkRepository) {}
  async handle(ctx: AuthenticatedContext, id: string): Promise<Result<Omit<DatasetDetail, "columns"> & { columnCount: number }, DomainError>> {
    const d = await loadDataset(this.deps, ctx, id);
    if (!d.ok) return d;
    const versions = await this.deps.catalog.listVersions(id, ctx.tenant.tenantId);
    if (!versions.ok) return versions;
    const manager = canManageDataset(d.value, viewerOf(ctx));
    // A pending upload is seen only by the person who sent it and the managers (§5).
    const seen = versions.value.filter((v) => v.status !== "PENDING" || manager || v.createdById === ctx.tenant.userId);
    const cur = seen.find((v) => v.id === d.value.currentVersionId);
    const links = await this.links.listForDataset(id, ctx.tenant.tenantId);
    const kit = d.value.kitKey ? kitOf(d.value.kitKey) : undefined;
    let pull: DatasetDetail["lastPull"];
    try { pull = d.value.connector?.lastPullJson ? { at: d.value.connector.lastPullAt, summary: (JSON.parse(d.value.connector.lastPullJson) as { summary?: string }).summary } : undefined; } catch { pull = undefined; }
    const item = listItem(d.value, cur, seen.filter((v) => v.status === "PENDING").length, ctx);
    return ok({
      ...item, columnCount: item.columns,
      ...(cur ? { current: { id: cur.id, number: cur.number, columns: cur.columns, figures: cur.figures.map((f) => ({ ...f, sentence: describeFigure(f, cur.columns) })), checks: cur.checks, steps: describeSteps(cur.steps), rawSteps: cur.steps, findings: cur.findings.slice(0, 100), rowCount: cur.rowCount, summary: cur.summary, createdAt: cur.createdAt.toISOString() } } : {}),
      versions: seen.map((v) => ({ id: v.id, number: v.number, status: v.status, rowCount: v.rowCount, summary: v.summary, createdAt: v.createdAt.toISOString(), mine: v.createdById === ctx.tenant.userId, ...(v.decisionNote ? { decisionNote: v.decisionNote } : {}) })),
      links: (links.ok ? links.value : []).map((l) => ({ id: l.id, indicatorId: l.indicatorId, figureRef: l.figureRef, byPlace: l.byPlace, ...(l.lastSync ? { lastSync: l.lastSync } : {}) })),
      sharePolicy: d.value.sharePolicy, ...(d.value.restricted ? { restriction: d.value.restriction } : {}),
      ...(kit ? { kit: { key: kit.key, title: kit.title, reviewState: kit.reviewState, source: kit.source, mapping: d.value.kitMapping } } : {}),
      ...(d.value.connector && manager ? { connectorConfig: { kind: d.value.connector.kind, ...d.value.connector.config } } : {}),
      ...(pull ? { lastPull: pull } : {}),
    });
  }
}

/** The kits on offer, with their review state and the headers of their template sheet. */
export class ListDatasetKitsHandler {
  handle(ctx: AuthenticatedContext): Result<{ kits: Array<{ key: string; title: string; description: string; sector: string; reviewState: string; source: string; columns: number; pages: number; template: string[] }> }, DomainError> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot see datasets"));
    return ok({ kits: KITS.map((k) => ({ key: k.key, title: k.title, description: k.description, sector: k.sector, reviewState: k.reviewState, source: k.source, columns: k.columns.length, pages: k.pages.length, template: kitTemplate(k).headers })) });
  }
}
