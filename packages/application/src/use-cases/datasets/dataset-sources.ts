import {
  catalogueWith, datasetIdOf, datasetRowsToVisual, datasetSourceId, datasetToSource, guestColumns, hiddenOnLinks, rowsWithNotes, PERIOD_KEY_FIELD, PLACE_ID_FIELD,
  type DataSourceDef, type DatasetBlockData, type DatasetRowValues, type Result, type VisualRow,
} from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IDatasetRowStore, StoredDataset, StoredDatasetVersion } from "../../ports/datasets.js";
import { canSeeDataset, formColumns, formDatasetId, formIdOf, formRows } from "@donordesk/domain";
import type { ICollectionFormRepository, ICollectionRecordRepository } from "../../ports/collection.js";

/** Collection forms whose accepted records are offered as datasets (J6); optional so the module works without them. */
export interface FormRecordsReader { forms: Pick<ICollectionFormRepository, "listByProject" | "findById">; records: Pick<ICollectionRecordRepository, "listByForm"> }
import { visibleIds, viewerOf, type DatasetDeps } from "./dataset-shared.js";

/**
 * Datasets as catalogue sources (§3.2) and as the data of dataset blocks. Versions are immutable, so their rows are cached in memory by
 * version id (a small LRU): a canvas with ten visuals on one dataset reads its rows once. Everything is read under the viewer's own
 * access; a share link (`guest`) never sees a restricted dataset, its hidden columns, or its partner, donor and money columns.
 */
export interface DatasetFilter { source: string; column: string; values: string[] }

const MAX_CACHED = 12;

export class DatasetSources {
  private readonly cache = new Map<string, DatasetRowValues[]>();

  constructor(private readonly deps: DatasetDeps, private readonly rows: IDatasetRowStore, private readonly formsReader?: FormRecordsReader) {}

  /** The catalogue rows of the datasets the person can see (organisation ones and those of their projects). */
  async sourcesFor(ctx: AuthenticatedContext, projectId?: string): Promise<DataSourceDef[]> {
    const ids = await visibleIds(this.deps, ctx);
    if (!ids.ok) return [];
    const listed = await this.deps.catalog.list(ctx.tenant.tenantId, projectId ? [projectId] : [...ids.value]);
    if (!listed.ok) return [];
    const out: DataSourceDef[] = [];
    for (const d of listed.value.filter((x) => canSeeDataset(x, viewerOf(ctx)))) {
      const v = await this.current(ctx, d);
      if (v) out.push(datasetToSource(d, v.columns));
    }
    if (this.formsReader) {
      for (const pid of projectId ? [projectId] : [...ids.value]) {
        const forms = await this.formsReader.forms.listByProject(pid, ctx.tenant.tenantId);
        for (const f of forms.ok ? forms.value.filter((x) => x.status !== "DRAFT") : []) out.push(datasetToSource({ id: formDatasetId(f.id), name: `Form: ${f.name}`, description: "Accepted records of a collection form.", scope: "PROJECT", projectId: f.projectId, restricted: false }, formColumns(f.definition)));
      }
    }
    return out;
  }

  /** The data a dataset block resolves from, or undefined when it cannot be read for this viewer. */
  async blockData(ctx: AuthenticatedContext, sourceId: string, filters: readonly DatasetFilter[], options: { guest?: boolean } = {}): Promise<DatasetBlockData | undefined> {
    const id = datasetIdOf(sourceId);
    if (!id) return undefined;
    const formId = formIdOf(id);
    if (formId) return this.formData(ctx, sourceId, formId, filters, options);
    const found = await this.deps.catalog.findById(id, ctx.tenant.tenantId);
    if (!found.ok || !found.value) return undefined;
    const d = found.value;
    if (options.guest ? d.restricted : !canSeeDataset(d, viewerOf(ctx))) return undefined;
    if (d.projectId && !options.guest) { const ids = await visibleIds(this.deps, ctx); if (!ids.ok || !ids.value.has(d.projectId)) return undefined; }
    const v = await this.current(ctx, d);
    if (!v) return undefined;
    const all = await this.versionRows(ctx, v.id);
    if (!all) return undefined;
    const columns = options.guest ? guestColumns(v.columns, d.sharePolicy) : v.columns;
    const source = datasetToSource(d, columns);
    const allowed = new Set(source.fields.map((f) => f.id));
    const mine = filters.filter((f) => f.source === sourceId && allowed.has(f.column) && f.values.length > 0);
    let rows = datasetRowsToVisual(all);
    for (const f of mine) { const want = new Set(f.values.map((x) => x.toLowerCase())); rows = rows.filter((r) => want.has(String(r.values[f.column] ?? "").toLowerCase())); }
    if (options.guest) rows = rows.map((r) => ({ values: Object.fromEntries(Object.entries(r.values).filter(([k]) => allowed.has(k) || k === PLACE_ID_FIELD || k === PERIOD_KEY_FIELD)) as VisualRow["values"] }));
    const noted = rowsWithNotes(v.findings);
    const label = new Map(source.fields.map((f) => [f.id, f.label]));
    return { source, rows, totalRows: all.length, notedRows: all.filter((r) => noted.has(r.rowNo)).length, filtered: mine.map((f) => `${label.get(f.column) ?? f.column}: ${f.values.slice(0, 3).join(", ")}${f.values.length > 3 ? "…" : ""}`) };
  }

  /** A form's accepted records, read now (nothing is copied); a link reads them as a guest only when the canvas names the project. */
  private async formData(ctx: AuthenticatedContext, sourceId: string, formId: string, filters: readonly DatasetFilter[], options: { guest?: boolean }): Promise<DatasetBlockData | undefined> {
    if (!this.formsReader) return undefined;
    const f = await this.formsReader.forms.findById(formId, ctx.tenant.tenantId);
    if (!f.ok || !f.value) return undefined;
    if (!options.guest) { const ids = await visibleIds(this.deps, ctx); if (!ids.ok || !ids.value.has(f.value.projectId)) return undefined; }
    const recs = await this.formsReader.records.listByForm(formId, ctx.tenant.tenantId, "ACCEPTED");
    if (!recs.ok) return undefined;
    const columns = formColumns(f.value.definition);
    const source = datasetToSource({ id: formDatasetId(formId), name: `Form: ${f.value.name}`, description: "", scope: "PROJECT", projectId: f.value.projectId, restricted: false }, columns);
    let rows = datasetRowsToVisual(formRows(recs.value, columns));
    const mine = filters.filter((x) => x.source === sourceId && x.values.length);
    for (const x of mine) { const want = new Set(x.values.map((v) => v.toLowerCase())); rows = rows.filter((r) => want.has(String(r.values[x.column] ?? "").toLowerCase())); }
    return { source, rows, totalRows: recs.value.length, notedRows: 0, filtered: mine.map((x) => `${x.column}: ${x.values.join(", ")}`) };
  }

  async catalogueFor(ctx: AuthenticatedContext, projectId?: string) { return catalogueWith(await this.sourcesFor(ctx, projectId)); }

  private async current(ctx: AuthenticatedContext, d: StoredDataset): Promise<StoredDatasetVersion | undefined> {
    if (!d.currentVersionId) return undefined;
    const v = await this.deps.catalog.findVersion(d.currentVersionId, ctx.tenant.tenantId);
    return v.ok && v.value ? v.value : undefined;
  }

  private async versionRows(ctx: AuthenticatedContext, versionId: string): Promise<DatasetRowValues[] | undefined> {
    const hit = this.cache.get(versionId);
    if (hit) { this.cache.delete(versionId); this.cache.set(versionId, hit); return hit; }
    const read: Result<DatasetRowValues[]> = await this.rows.read(ctx.tenant.tenantId, versionId);
    if (!read.ok) return undefined;
    this.cache.set(versionId, read.value);
    while (this.cache.size > MAX_CACHED) this.cache.delete(this.cache.keys().next().value!);
    return read.value;
  }
}

export { datasetSourceId, hiddenOnLinks };
