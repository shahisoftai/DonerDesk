import { DomainError, datasetConnectorDef, nextPullAt, type DatasetConnectorConfig, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IConnectorFetch, IDatasetSecretStore, IWorkbookReader, StoredDataset } from "../../ports/datasets.js";
import { can, fail, loadManaged, ok, type DatasetDeps } from "./dataset-shared.js";
import type { VersionBuilder } from "./version-builder.js";
import type { SyncDatasetLinksHandler } from "./link-handlers.js";

/**
 * A connector that fills a dataset (§3.10, J8): its settings are stored on the dataset, its key encrypted and never returned. A pull
 * reads the other system, turns the answer into a table and saves it as a new version through the same builder as an upload ("Add new
 * periods" by default), so the steps, checks and links apply exactly as for a file.
 */
export class SaveDatasetConnectorHandler {
  constructor(private readonly deps: DatasetDeps, private readonly secrets: IDatasetSecretStore) {}
  async handle(ctx: AuthenticatedContext, datasetId: string, input: { config: DatasetConnectorConfig; credential?: string | undefined } | null): Promise<Result<void, DomainError>> {
    const d = await loadManaged(this.deps, ctx, datasetId);
    if (!d.ok) return d;
    if (input === null) {
      await this.deps.catalog.update({ ...d.value, connector: undefined, updatedAt: this.deps.clock.now() });
      await this.secrets.write(datasetId, ctx.tenant.tenantId, null);
      return ok(undefined);
    }
    const def = datasetConnectorDef(input.config.kind);
    if (!def) return fail(DomainError.validation("That connector is not offered."));
    const bad = def.problems(input.config)[0];
    if (bad) return fail(DomainError.validation(bad));
    if (input.credential !== undefined) {
      if (!this.secrets.available()) return fail(DomainError.validation("Connector keys cannot be stored on this server yet (no encryption key is set up)."));
      await this.secrets.write(datasetId, ctx.tenant.tenantId, input.credential ? this.secrets.seal(input.credential) : null);
    }
    const { kind, ...config } = input.config;
    await this.deps.catalog.update({ ...d.value, connector: { kind, config, ...(d.value.connector?.lastPullAt ? { lastPullAt: d.value.connector.lastPullAt } : {}) }, updatedAt: this.deps.clock.now() });
    await this.deps.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "dataset.connector_saved", entityType: "dataset", entityId: datasetId, newValue: JSON.stringify({ kind, schedule: input.config.schedule }) });
    return ok(undefined);
  }
}

export class PullDatasetConnectorHandler {
  constructor(private readonly deps: DatasetDeps, private readonly secrets: IDatasetSecretStore, private readonly http: IConnectorFetch, private readonly builder: VersionBuilder, private readonly reader: IWorkbookReader, private readonly links?: Pick<SyncDatasetLinksHandler, "handle">) {}

  async handle(ctx: AuthenticatedContext, datasetId: string): Promise<Result<{ summary: string; versionId?: string | undefined }, DomainError>> {
    if (!can(ctx, "dataset.manage")) return fail(DomainError.forbidden("You cannot pull data into this dataset"));
    const d = await loadManaged(this.deps, ctx, datasetId);
    if (!d.ok) return d;
    return this.pull(ctx, d.value);
  }

  /** One pull. A failure is kept on the dataset (shown on its page) and never half-saves. */
  async pull(ctx: AuthenticatedContext, d: StoredDataset): Promise<Result<{ summary: string; versionId?: string | undefined }, DomainError>> {
    const c = d.connector;
    const def = c ? datasetConnectorDef(c.kind) : undefined;
    if (!c || !def) return fail(DomainError.validation("This dataset has no connector."));
    const sealed = await this.secrets.read(d.id, ctx.tenant.tenantId);
    const credential = sealed.ok && sealed.value ? this.secrets.open(sealed.value) : undefined;
    if (!credential) return this.record(ctx, d, "The connector's key is missing. Enter it again in the connector settings.");
    const req = def.request({ kind: c.kind, ...(c.config as Omit<DatasetConnectorConfig, "kind">) }, credential);
    if (!req.ok) return this.record(ctx, d, req.error.message);
    const got = await this.http.getJson(req.value.url, req.value.headers);
    if (!got.ok) return this.record(ctx, d, `${def.label} did not answer: ${got.error.message}`);
    const table = def.parse(got.value);
    if (!table.ok) return this.record(ctx, d, table.error.message);
    const csv = [table.value.headers, ...table.value.rows].map((r) => r.map((x) => (x === null ? "" : `"${String(x).replace(/"/g, '""')}"`)).join(",")).join("\n");
    const current = d.currentVersionId ? await this.deps.catalog.findVersion(d.currentVersionId, ctx.tenant.tenantId) : undefined;
    const base = current?.ok ? current.value ?? undefined : undefined;
    const built = await this.builder.build(ctx, d, { bytes: Buffer.from(csv, "utf8"), fileName: `${def.label.toLowerCase()}-pull.csv`, steps: base?.steps ?? [], columns: base?.columns, figures: base?.figures ?? [], checks: base?.checks ?? [], mode: base ? "ADD_PERIODS" : "REPLACE", accepted: true });
    if (!built.ok) return this.record(ctx, d, built.error.message);
    await this.deps.catalog.update({ ...d, currentVersionId: built.value.id, connector: { ...c, lastPullAt: this.deps.clock.now().toISOString(), lastPullJson: JSON.stringify({ ok: true, summary: built.value.summary }) }, updatedAt: this.deps.clock.now() });
    await this.deps.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "dataset.pulled", entityType: "dataset", entityId: d.id, newValue: JSON.stringify({ kind: c.kind, rows: built.value.rowCount }) });
    await this.links?.handle(ctx, d.id);
    return ok({ summary: built.value.summary, versionId: built.value.id });
  }

  private async record(ctx: AuthenticatedContext, d: StoredDataset, problem: string): Promise<Result<{ summary: string }, DomainError>> {
    if (d.connector) await this.deps.catalog.update({ ...d, connector: { ...d.connector, lastPullAt: this.deps.clock.now().toISOString(), lastPullJson: JSON.stringify({ ok: false, summary: problem }) }, updatedAt: this.deps.clock.now() });
    await this.deps.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "dataset.pull_failed", entityType: "dataset", entityId: d.id, newValue: JSON.stringify({ problem: problem.slice(0, 200) }) });
    return fail(DomainError.validation(problem));
  }
}

/**
 * The scheduled run (the hourly timer calls it per organisation): pulls every dataset of the organisation whose schedule is due. It acts
 * as the person who set the connector up (their id is on every version and audit row); a failure is kept on the dataset, never silent.
 */
export class RunScheduledDatasetPullsHandler {
  constructor(private readonly deps: DatasetDeps, private readonly pull: Pick<PullDatasetConnectorHandler, "pull">) {}
  async handle(tenantId: import("@donordesk/domain").TenantId): Promise<Result<{ pulled: number; failed: number }, DomainError>> {
    const all = await this.deps.catalog.listWithConnector();
    if (!all.ok) return all;
    const now = this.deps.clock.now();
    let pulled = 0, failed = 0;
    for (const d of all.value.filter((x) => x.tenantId.toString() === tenantId.toString())) {
      const schedule = (d.connector?.config.schedule as DatasetConnectorConfig["schedule"] | undefined) ?? "MANUAL";
      const due = nextPullAt(schedule, d.connector?.lastPullAt ? new Date(d.connector.lastPullAt) : undefined, now);
      if (!due || due > now) continue;
      const ctx: AuthenticatedContext = { tenant: { tenantId, userId: d.createdById, role: "ADMIN" }, requestId: "scheduled-dataset-pull" };
      const r = await this.pull.pull(ctx, d);
      if (r.ok) pulled += 1; else failed += 1;
    }
    return ok({ pulled, failed });
  }
}
