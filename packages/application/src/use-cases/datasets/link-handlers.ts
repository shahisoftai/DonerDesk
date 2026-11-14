import { DomainError, linkProblems, linkWriteFor, linkedValues, suggestLinks, type Result } from "@donordesk/domain";
import type { UpsertIndicatorUpdateInput } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { IDatasetLinkRepository, IDatasetRowStore, StoredDataset } from "../../ports/datasets.js";
import type { IIndicatorRepository, IIndicatorUpdateRepository } from "../../ports/logframe.js";
import type { IReportingPeriodRepository } from "../../ports/reporting.js";
import type { IPlaceRepository } from "../../ports/places.js";
import type { BulkUpsertIndicatorUpdatesHandler } from "../logframe/bulk-upsert-indicator-updates.js";
import { fail, loadDataset, loadManaged, ok, type DatasetDeps } from "./dataset-shared.js";

/**
 * "Use this figure for indicator X" (§3.9, J5). A link is a definition; writing happens on save and on every refresh, as DRAFT values
 * through the ordinary bulk save, so entry windows, period locks and verification all apply. A verified value is never overwritten: a
 * difference becomes a note shown to the reviewer.
 */
export interface LinkDeps { links: IDatasetLinkRepository; rows: IDatasetRowStore; indicators: IIndicatorRepository; updates: IIndicatorUpdateRepository; periods: IReportingPeriodRepository; places: IPlaceRepository; save: Pick<BulkUpsertIndicatorUpdatesHandler, "handle"> }

async function currentVersion(deps: DatasetDeps, ctx: AuthenticatedContext, d: StoredDataset) {
  if (!d.currentVersionId) return undefined;
  const v = await deps.catalog.findVersion(d.currentVersionId, ctx.tenant.tenantId);
  return v.ok && v.value ? v.value : undefined;
}

export class AddDatasetLinkHandler {
  constructor(private readonly deps: DatasetDeps, private readonly link: LinkDeps, private readonly sync: SyncDatasetLinksHandler) {}
  async handle(ctx: AuthenticatedContext, datasetId: string, input: { indicatorId: string; figureRef: string; filters?: Array<{ column: string; values: string[] }> | undefined; byPlace?: boolean | undefined }): Promise<Result<{ id: string; written: number; notes: string[] }, DomainError>> {
    const d = await loadManaged(this.deps, ctx, datasetId);
    if (!d.ok) return d;
    if (!d.value.projectId) return fail(DomainError.validation("Only a project's dataset can feed its indicators."));
    const ind = await this.link.indicators.findById(input.indicatorId, ctx.tenant.tenantId);
    if (!ind.ok) return ind;
    if (!ind.value || ind.value.projectId !== d.value.projectId) return fail(DomainError.notFound("Indicator", input.indicatorId));
    const v = await currentVersion(this.deps, ctx, d.value);
    if (!v) return fail(DomainError.validation("The dataset has no saved rows yet."));
    const def = { indicatorId: input.indicatorId, figureRef: input.figureRef, filters: input.filters ?? [], byPlace: input.byPlace ?? false };
    const bad = linkProblems(def, { id: ind.value.id, type: ind.value.type, recordByPlace: ind.value.recordByPlace, formula: Boolean(ind.value.formula) }, v.columns, v.figures)[0];
    if (bad) return fail(DomainError.validation(bad));
    const id = this.deps.ids.generate();
    const created = await this.link.links.create({ id, tenantId: ctx.tenant.tenantId, datasetId, ...def, createdById: ctx.tenant.userId, createdAt: this.deps.clock.now() });
    if (!created.ok) return created;
    await this.deps.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "dataset.link_added", entityType: "dataset", entityId: datasetId, projectId: d.value.projectId, newValue: JSON.stringify({ indicatorId: input.indicatorId, figure: input.figureRef }) });
    const synced = await this.sync.handle(ctx, datasetId, id);
    return ok({ id, written: synced.ok ? synced.value.written : 0, notes: synced.ok ? synced.value.notes : [synced.error.message] });
  }
}

export class RemoveDatasetLinkHandler {
  constructor(private readonly deps: DatasetDeps, private readonly links: IDatasetLinkRepository) {}
  async handle(ctx: AuthenticatedContext, datasetId: string, linkId: string): Promise<Result<void, DomainError>> {
    const d = await loadManaged(this.deps, ctx, datasetId);
    if (!d.ok) return d;
    const removed = await this.links.delete(linkId, ctx.tenant.tenantId);
    if (!removed.ok) return removed;
    await this.deps.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "dataset.link_removed", entityType: "dataset", entityId: datasetId });
    return ok(undefined);
  }
}

/** Writes every link of a dataset (or one) as drafts for the project's open periods. Values already verified are noted, never changed. */
export class SyncDatasetLinksHandler {
  constructor(private readonly deps: DatasetDeps, private readonly link: LinkDeps) {}
  async handle(ctx: AuthenticatedContext, datasetId: string, onlyLinkId?: string): Promise<Result<{ written: number; notes: string[] }, DomainError>> {
    const d = await loadDataset(this.deps, ctx, datasetId);
    if (!d.ok) return d;
    if (!d.value.projectId) return ok({ written: 0, notes: [] });
    const links = await this.link.links.listForDataset(datasetId, ctx.tenant.tenantId);
    if (!links.ok) return links;
    const mine = links.value.filter((l) => !onlyLinkId || l.id === onlyLinkId);
    const v = await currentVersion(this.deps, ctx, d.value);
    if (!v || mine.length === 0) return ok({ written: 0, notes: [] });
    const [rows, periods, places] = await Promise.all([this.link.rows.read(ctx.tenant.tenantId, v.id), this.link.periods.findByProject(d.value.projectId, ctx.tenant.tenantId), this.link.places.list(ctx.tenant.tenantId)]);
    if (!rows.ok) return rows;
    if (!periods.ok) return periods;
    const names = new Map((places.ok ? places.value : []).map((p) => [p.id, p.name]));
    const spans = periods.value.map((p) => ({ id: p.id, startDate: p.duration.start.toISOString().slice(0, 10), endDate: p.duration.end.toISOString().slice(0, 10) }));
    const byPeriod = new Map<string, UpsertIndicatorUpdateInput[]>();
    const notes: string[] = [];
    const sourceNote = `From dataset "${d.value.name}"`;
    for (const l of mine) {
      for (const val of linkedValues(l, rows.value, v.columns, v.figures, spans, (id) => names.get(id))) {
        const stored = await this.link.updates.findByIndicatorAndPeriod(l.indicatorId, val.periodId, ctx.tenant.tenantId);
        const s = stored.ok && stored.value ? { value: Number.isFinite(Number(stored.value.periodAchievement)) && stored.value.periodAchievement !== "" ? Number(stored.value.periodAchievement) : null, status: stored.value.verificationStatus } : undefined;
        const w = linkWriteFor(val.value, s);
        if (w.action === "NOTE_VERIFIED") { notes.push(`A verified value (${w.stored ?? "none"}) differs from the dataset (${w.incoming}); it was not changed. A reviewer can reopen it.`); continue; }
        if (w.action !== "WRITE") continue;
        const entry: UpsertIndicatorUpdateInput = { indicatorId: l.indicatorId, periodAchievement: String(w.value), cumulativeAchievement: "", dataSource: sourceNote.slice(0, 500), ...(val.byPlace && Object.keys(val.byPlace).length ? { disaggregation: Object.entries(val.byPlace).slice(0, 50).map(([category, value]) => ({ dimension: "LOCATION", category, value: String(value) })) as never } : {}) };
        byPeriod.set(val.periodId, [...(byPeriod.get(val.periodId) ?? []), entry]);
      }
    }
    let written = 0;
    for (const [periodId, updates] of byPeriod) {
      const saved = await this.link.save.handle(ctx, { reportingPeriodId: periodId, updates });
      if (saved.ok) written += saved.value.saved;
      else notes.push(saved.error.message);
    }
    const at = this.deps.clock.now().toISOString();
    for (const l of mine) await this.link.links.setLastSync(l.id, ctx.tenant.tenantId, { at, written, notes: notes.slice(0, 10) });
    if (written) await this.deps.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "dataset.links_synced", entityType: "dataset", entityId: datasetId, projectId: d.value.projectId, newValue: JSON.stringify({ written, notes: notes.length }) });
    return ok({ written, notes: [...new Set(notes)].slice(0, 10) });
  }
}

/** Indicators of the project a column could feed (§8.1): suggestions only, one tick creates the link. */
export class SuggestDatasetLinksHandler {
  constructor(private readonly deps: DatasetDeps, private readonly indicators: IIndicatorRepository) {}
  async handle(ctx: AuthenticatedContext, datasetId: string): Promise<Result<{ suggestions: Array<{ column: string; indicatorId: string; indicator: string; reason: string }> }, DomainError>> {
    const d = await loadDataset(this.deps, ctx, datasetId);
    if (!d.ok) return d;
    if (!d.value.projectId || !d.value.currentVersionId) return ok({ suggestions: [] });
    const [v, inds] = await Promise.all([this.deps.catalog.findVersion(d.value.currentVersionId, ctx.tenant.tenantId), this.indicators.findByProject(d.value.projectId, ctx.tenant.tenantId)]);
    if (!v.ok || !v.value || !inds.ok) return ok({ suggestions: [] });
    const list = inds.value.filter((i) => !i.formula).map((i) => ({ id: i.id, code: i.code, name: i.name, type: i.type }));
    const name = new Map(list.map((i) => [i.id, `${i.code} ${i.name}`]));
    return ok({ suggestions: suggestLinks(v.value.columns, list).map((s) => ({ ...s, indicator: name.get(s.indicatorId) ?? s.indicatorId })) });
  }
}
