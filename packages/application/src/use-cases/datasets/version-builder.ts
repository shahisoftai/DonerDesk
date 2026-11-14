import { DomainError, MAX_VERSIONS_KEPT, blocks, figureProblems, planRefresh, type CheckConfig, type ColumnDef, type DatasetFigure, type RefreshMode, type Result, type TidyStep } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IDatasetRowStore, IWorkbookReader, StoredDataset, StoredDatasetVersion } from "../../ports/datasets.js";
import { fail, ok, placeRegistry, type DatasetDeps } from "./dataset-shared.js";
import { runPipeline } from "./pipeline.js";
import { fileHash } from "./upload-handlers.js";

/**
 * Makes a version (§3.10): runs the file through the pipeline, refuses when a check blocks or personal data is left in an unrestricted
 * dataset, merges with the current rows for "Add new periods", writes the rows, and keeps the file beside the version so the steps can
 * be replayed. Versions are immutable; the oldest beyond ten are removed with their rows and file.
 */
export interface VersionInput {
  bytes: Buffer;
  fileName: string;
  steps: TidyStep[];
  columns?: ColumnDef[] | undefined;
  figures: DatasetFigure[];
  checks: CheckConfig[];
  mode: RefreshMode;
  /** PENDING for a contributor's upload; ACCEPTED for a manager's. */
  accepted: boolean;
  projectCountry?: string | undefined;
}

export class VersionBuilder {
  constructor(private readonly deps: DatasetDeps, private readonly reader: IWorkbookReader, private readonly rows: IDatasetRowStore) {}

  async build(ctx: AuthenticatedContext, dataset: StoredDataset, input: VersionInput): Promise<Result<StoredDatasetVersion, DomainError>> {
    const wb = await this.reader.read(input.bytes, input.fileName);
    if (!wb.ok) return wb;
    const result = runPipeline({ workbook: wb.value, steps: input.steps, columns: input.columns, checks: input.checks, places: await placeRegistry(this.deps.places, ctx), country: input.projectCountry });
    if (result.problem) return fail(DomainError.validation(result.problem));
    const figProblem = figureProblems(input.figures, result.columns)[0];
    if (figProblem) return fail(DomainError.validation(figProblem));
    if (blocks(result.findings)) return fail(DomainError.validation(`The table has problems to fix before it is saved: ${result.findings.find((f) => f.severity === "BLOCK")!.message}`, { findings: result.findings.slice(0, 20) }));
    if (result.personal.length && !dataset.restricted) {
      const p = result.personal[0]!;
      return fail(DomainError.validation(`The column "${p.header}" looks like personal data (${p.label}). Datasets hold figures: leave the column out, or ask an administrator to make the dataset restricted.`));
    }
    const versions = await this.deps.catalog.listVersions(dataset.id, ctx.tenant.tenantId);
    if (!versions.ok) return versions;
    let rows = result.rows;
    let summary = `${rows.length.toLocaleString("en")} rows`;
    if (dataset.currentVersionId) {
      const current = await this.rows.read(ctx.tenant.tenantId, dataset.currentVersionId);
      if (!current.ok) return current;
      const plan = planRefresh(current.value, result.rows, result.columns, input.mode);
      rows = plan.rows;
      summary = plan.diff.summary;
    }
    const id = this.deps.ids.generate();
    const fileKey = `datasets/${ctx.tenant.tenantId.toString()}/${dataset.id}/${id}`;
    await this.deps.storage.put({ key: fileKey, body: input.bytes, contentType: "application/octet-stream" });
    const version: StoredDatasetVersion = {
      id, tenantId: ctx.tenant.tenantId, datasetId: dataset.id, number: (versions.value[0]?.number ?? 0) + 1,
      columns: result.columns, steps: input.steps, figures: input.figures, checks: input.checks, rowCount: rows.length,
      fileKey, fileName: input.fileName, fileHash: fileHash(input.bytes), findings: result.findings, summary,
      status: input.accepted ? "ACCEPTED" : "PENDING", ...(input.accepted ? { decidedById: ctx.tenant.userId } : {}), createdById: ctx.tenant.userId, createdAt: this.deps.clock.now(),
    };
    const wrote = await this.rows.write(ctx.tenant.tenantId, id, rows);
    if (!wrote.ok) return wrote;
    const created = await this.deps.catalog.createVersion(version);
    if (!created.ok) { await this.rows.remove(ctx.tenant.tenantId, id); return created; }
    await this.prune(ctx, [version, ...versions.value], dataset.currentVersionId);
    return ok(version);
  }

  /** Keeps the newest ten versions; never removes the current one or one waiting for a decision. */
  private async prune(ctx: AuthenticatedContext, versions: readonly StoredDatasetVersion[], currentId: string | undefined): Promise<void> {
    for (const old of versions.slice(MAX_VERSIONS_KEPT)) {
      if (old.id === currentId || old.status === "PENDING") continue;
      await this.removeVersion(ctx, old);
    }
  }

  async removeVersion(ctx: AuthenticatedContext, v: StoredDatasetVersion): Promise<void> {
    await this.rows.remove(ctx.tenant.tenantId, v.id);
    if (v.fileKey) await this.deps.storage.remove(v.fileKey).catch(() => undefined);
    await this.deps.catalog.deleteVersion(v.id, ctx.tenant.tenantId);
  }
}
