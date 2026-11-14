import {
  DomainError, MAX_DATASET_NAME, kitOf, restrictionProblems,
  type CheckConfig, type ColumnDef, type DatasetFigure, type DatasetScope, type RefreshMode, type Restriction, type Result, type SharePolicy, type TidyStep,
} from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { StoredDataset } from "../../ports/datasets.js";
import { can, fail, loadForContribution, loadManaged, ok, ownsUpload, visibleIds, type DatasetDeps } from "./dataset-shared.js";
import { mappingByHeader } from "./pipeline.js";
import type { VersionBuilder } from "./version-builder.js";

export interface SaveDatasetInput {
  name: string;
  description?: string | undefined;
  scope: DatasetScope;
  projectId?: string | undefined;
  fileKey: string;
  fileName: string;
  steps: TidyStep[];
  columns: ColumnDef[];
  figures?: DatasetFigure[] | undefined;
  checks?: CheckConfig[] | undefined;
  kitKey?: string | undefined;
  kitMapping?: Record<string, string> | undefined;
  projectCountry?: string | undefined;
}

const readUpload = async (deps: DatasetDeps, ctx: AuthenticatedContext, key: string): Promise<Result<Buffer, DomainError>> => {
  if (!ownsUpload(ctx, key)) return fail(DomainError.notFound("Upload", key));
  try { return ok(await deps.storage.read(key)); } catch { return fail(DomainError.validation("The uploaded file is no longer here. Upload it again.")); }
};

/** Creates a dataset and its first version (§4.2 screen 7). Organisation datasets: administrators; project datasets: managers of the project. */
export class SaveDatasetHandler {
  constructor(private readonly deps: DatasetDeps, private readonly builder: VersionBuilder) {}

  async handle(ctx: AuthenticatedContext, input: SaveDatasetInput): Promise<Result<{ id: string; versionId: string; summary: string }, DomainError>> {
    const name = input.name.trim();
    if (!name || name.length > MAX_DATASET_NAME) return fail(DomainError.validation(`A dataset's name is 1 to ${MAX_DATASET_NAME} characters.`));
    if (input.scope === "ORGANISATION" ? !can(ctx, "org.manage") : !can(ctx, "dataset.manage")) return fail(DomainError.forbidden(input.scope === "ORGANISATION" ? "Only an administrator can make an organisation dataset" : "Only an administrator or a project manager can make a dataset"));
    if (input.scope === "PROJECT") {
      if (!input.projectId) return fail(DomainError.validation("Choose the project the dataset belongs to."));
      const ids = await visibleIds(this.deps, ctx);
      if (!ids.ok) return ids;
      if (!ids.value.has(input.projectId)) return fail(DomainError.notFound("Project", input.projectId));
    }
    if (input.kitKey && !kitOf(input.kitKey)) return fail(DomainError.validation("That kit is not known."));
    const bytes = await readUpload(this.deps, ctx, input.fileKey);
    if (!bytes.ok) return bytes;
    const now = this.deps.clock.now();
    const id = this.deps.ids.generate();
    const dataset: StoredDataset = {
      id, tenantId: ctx.tenant.tenantId, scope: input.scope, ...(input.scope === "PROJECT" ? { projectId: input.projectId } : {}), name, description: (input.description ?? "").trim().slice(0, 1000),
      ...(input.kitKey ? { kitKey: input.kitKey } : {}), kitMapping: mappingByHeader(input.kitMapping ?? {}, input.columns), sharePolicy: { hidden: [] }, restricted: false,
      createdById: ctx.tenant.userId, createdAt: now, updatedAt: now,
    };
    const created = await this.deps.catalog.create(dataset);
    if (!created.ok) return created;
    const v = await this.builder.build(ctx, dataset, { bytes: bytes.value, fileName: input.fileName, steps: input.steps, columns: input.columns, figures: input.figures ?? [], checks: input.checks ?? [], mode: "REPLACE", accepted: true, projectCountry: input.projectCountry });
    if (!v.ok) { await this.deps.catalog.delete(id, ctx.tenant.tenantId); return v; }
    await this.deps.catalog.update({ ...dataset, currentVersionId: v.value.id, updatedAt: now });
    await this.deps.storage.remove(input.fileKey).catch(() => undefined);
    await this.deps.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "dataset.created", entityType: "dataset", entityId: id, ...(input.projectId ? { projectId: input.projectId } : {}), newValue: JSON.stringify({ rows: v.value.rowCount, columns: v.value.columns.length, kit: input.kitKey ?? null }) });
    return ok({ id, versionId: v.value.id, summary: v.value.summary });
  }
}

/**
 * A new upload for an existing dataset (§3.10, J2): "Replace" or "Add new periods", replaying the dataset's steps and columns so a monthly
 * upload needs no rework. A contributor's upload waits for a manager's acceptance; a manager's becomes current at once.
 */
export class AddDatasetVersionHandler {
  constructor(private readonly deps: DatasetDeps, private readonly builder: VersionBuilder) {}

  async handle(ctx: AuthenticatedContext, datasetId: string, input: { fileKey: string; fileName: string; mode: RefreshMode; steps?: TidyStep[] | undefined; columns?: ColumnDef[] | undefined; projectCountry?: string | undefined }): Promise<Result<{ versionId: string; summary: string; status: string }, DomainError>> {
    const loaded = await loadForContribution(this.deps, ctx, datasetId);
    if (!loaded.ok) return loaded;
    const { dataset, manager } = loaded.value;
    const current = dataset.currentVersionId ? await this.deps.catalog.findVersion(dataset.currentVersionId, ctx.tenant.tenantId) : undefined;
    if (current && !current.ok) return current;
    const base = current?.value ?? undefined;
    // A contributor adds data; only a manager may change the steps or columns.
    const steps = manager && input.steps ? input.steps : base?.steps ?? [];
    const columns = manager && input.columns ? input.columns : base?.columns;
    const bytes = await readUpload(this.deps, ctx, input.fileKey);
    if (!bytes.ok) return bytes;
    const v = await this.builder.build(ctx, dataset, { bytes: bytes.value, fileName: input.fileName, steps, columns, figures: base?.figures ?? [], checks: base?.checks ?? [], mode: input.mode, accepted: manager, projectCountry: input.projectCountry });
    if (!v.ok) return v;
    if (manager) await this.deps.catalog.update({ ...dataset, currentVersionId: v.value.id, updatedAt: this.deps.clock.now() });
    await this.deps.storage.remove(input.fileKey).catch(() => undefined);
    await this.deps.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: manager ? "dataset.refreshed" : "dataset.contributed", entityType: "dataset", entityId: datasetId, ...(dataset.projectId ? { projectId: dataset.projectId } : {}), newValue: JSON.stringify({ version: v.value.number, mode: input.mode, rows: v.value.rowCount }) });
    return ok({ versionId: v.value.id, summary: v.value.summary, status: v.value.status });
  }
}

/** A manager accepts or rejects a contributor's upload; accepting makes it current. A rejection needs a reason. */
export class DecideDatasetVersionHandler {
  constructor(private readonly deps: DatasetDeps) {}
  async handle(ctx: AuthenticatedContext, datasetId: string, versionId: string, input: { accept: boolean; note?: string | undefined }): Promise<Result<void, DomainError>> {
    const d = await loadManaged(this.deps, ctx, datasetId);
    if (!d.ok) return d;
    const v = await this.deps.catalog.findVersion(versionId, ctx.tenant.tenantId);
    if (!v.ok) return v;
    if (!v.value || v.value.datasetId !== datasetId) return fail(DomainError.notFound("Version", versionId));
    if (v.value.status !== "PENDING") return fail(DomainError.conflict("This upload has already been decided."));
    if (!input.accept && !input.note?.trim()) return fail(DomainError.validation("Say why the upload is not accepted; the person who sent it is told."));
    const decided = await this.deps.catalog.decideVersion(versionId, ctx.tenant.tenantId, input.accept ? "ACCEPTED" : "REJECTED", ctx.tenant.userId, input.note?.trim());
    if (!decided.ok) return decided;
    if (input.accept) await this.deps.catalog.update({ ...d.value, currentVersionId: versionId, updatedAt: this.deps.clock.now() });
    await this.deps.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: input.accept ? "dataset.version_accepted" : "dataset.version_rejected", entityType: "dataset", entityId: datasetId, newValue: JSON.stringify({ version: v.value.number }) });
    return ok(undefined);
  }
}

/** An earlier accepted version becomes current again (the newer ones are kept). */
export class RestoreDatasetVersionHandler {
  constructor(private readonly deps: DatasetDeps) {}
  async handle(ctx: AuthenticatedContext, datasetId: string, versionId: string): Promise<Result<void, DomainError>> {
    const d = await loadManaged(this.deps, ctx, datasetId);
    if (!d.ok) return d;
    const v = await this.deps.catalog.findVersion(versionId, ctx.tenant.tenantId);
    if (!v.ok) return v;
    if (!v.value || v.value.datasetId !== datasetId || v.value.status !== "ACCEPTED") return fail(DomainError.notFound("Version", versionId));
    await this.deps.catalog.update({ ...d.value, currentVersionId: versionId, updatedAt: this.deps.clock.now() });
    await this.deps.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "dataset.version_restored", entityType: "dataset", entityId: datasetId, newValue: JSON.stringify({ version: v.value.number }) });
    return ok(undefined);
  }
}

/** Name, description and what a share link leaves out. Column changes go through a new version (`ReviseDatasetColumnsHandler`). */
export class UpdateDatasetHandler {
  constructor(private readonly deps: DatasetDeps) {}
  async handle(ctx: AuthenticatedContext, id: string, input: { name?: string | undefined; description?: string | undefined; sharePolicy?: SharePolicy | undefined; expectedUpdatedAt?: string | undefined }): Promise<Result<{ updatedAt: string }, DomainError>> {
    const d = await loadManaged(this.deps, ctx, id);
    if (!d.ok) return d;
    const name = input.name?.trim() ?? d.value.name;
    if (!name || name.length > MAX_DATASET_NAME) return fail(DomainError.validation(`A dataset's name is 1 to ${MAX_DATASET_NAME} characters.`));
    const now = this.deps.clock.now();
    const next: StoredDataset = { ...d.value, name, description: (input.description ?? d.value.description).trim().slice(0, 1000), sharePolicy: input.sharePolicy ? { hidden: [...new Set(input.sharePolicy.hidden)].slice(0, 200) } : d.value.sharePolicy, updatedAt: now };
    const saved = await this.deps.catalog.update(next, input.expectedUpdatedAt ? new Date(input.expectedUpdatedAt) : undefined);
    if (!saved.ok) return saved;
    if (!saved.value) return fail(DomainError.conflict("Someone else changed this dataset since you opened it. Reload to see their version."));
    await this.deps.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "dataset.updated", entityType: "dataset", entityId: id });
    return ok({ updatedAt: now.toISOString() });
  }
}

/** Restricted tier (§8.2): administrators only, with a lawful basis, a purpose, a retention date and named viewers. */
export class SetDatasetRestrictionHandler {
  constructor(private readonly deps: DatasetDeps) {}
  async handle(ctx: AuthenticatedContext, id: string, input: { restricted: boolean; restriction?: Restriction | undefined }): Promise<Result<void, DomainError>> {
    if (!can(ctx, "org.manage")) return fail(DomainError.forbidden("Only an administrator can make a dataset restricted"));
    const d = await loadManaged(this.deps, ctx, id);
    if (!d.ok) return d;
    if (input.restricted) {
      const bad = restrictionProblems(input.restriction, this.deps.clock.now().toISOString().slice(0, 10))[0];
      if (bad) return fail(DomainError.validation(bad));
    }
    await this.deps.catalog.update({ ...d.value, restricted: input.restricted, restriction: input.restricted ? input.restriction : undefined, updatedAt: this.deps.clock.now() });
    await this.deps.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: input.restricted ? "dataset.restricted" : "dataset.unrestricted", entityType: "dataset", entityId: id, newValue: JSON.stringify(input.restricted ? { lawfulBasis: input.restriction!.lawfulBasis, retainUntil: input.restriction!.retainUntil, viewers: input.restriction!.viewerIds.length } : {}) });
    return ok(undefined);
  }
}

export class DeleteDatasetHandler {
  constructor(private readonly deps: DatasetDeps, private readonly builder: VersionBuilder) {}
  async handle(ctx: AuthenticatedContext, id: string): Promise<Result<void, DomainError>> {
    const d = await loadManaged(this.deps, ctx, id);
    if (!d.ok) return d;
    const versions = await this.deps.catalog.listVersions(id, ctx.tenant.tenantId);
    if (!versions.ok) return versions;
    for (const v of versions.value) await this.builder.removeVersion(ctx, v);
    const removed = await this.deps.catalog.delete(id, ctx.tenant.tenantId);
    if (!removed.ok) return removed;
    await this.deps.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "dataset.deleted", entityType: "dataset", entityId: id, ...(d.value.projectId ? { projectId: d.value.projectId } : {}) });
    return ok(undefined);
  }
}
