import {
  CONNECTOR_LABEL, DomainError, MAX_PAGES_PER_SYNC, MAX_REPORTED_PROBLEMS, Permissions, connectorProblems, connectorRecordId, connectorRequest, emptySummary, mapExternalRow,
  parseExternalPage, toPlainDate, type ConnectorConfig, type ExternalRow, type Result, type Role, type SyncSummary,
} from "@donordesk/domain";
import type { SaveConnectorInput } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import type { ConnectorFetch, IConnectorHttp, IConnectorSecrets, ICollectionFormRepository, ICollectionRecordRepository, IDataConnectorRepository, StoredDataConnector } from "../../ports/collection.js";

/**
 * Brings submissions from KoboToolbox or SurveyCTO into a collection form (Phase 33.7). They arrive as records waiting for review, exactly
 * as if typed or sent by link, after the form's own rules have checked them. Pulling the same submission twice stores it once. A row the
 * form's rules refuse is reported and left where it is, so fixing the mapping and syncing again brings it in. The key is kept
 * encrypted, used only on the server, and never shown again.
 */

const can = (ctx: AuthenticatedContext) => Permissions.can(ctx.tenant.role as Role, "project.edit");
const fail = <T>(error: DomainError): Result<T, DomainError> => ({ ok: false, error });
const ok = <T>(value: T): Result<T, DomainError> => ({ ok: true, value });
const forbidden = () => fail<never>(DomainError.forbidden("Only someone who edits projects can manage connectors"));

export interface ConnectorDto {
  id: string;
  name: string;
  kind: StoredDataConnector["kind"];
  kindLabel: string;
  serverUrl: string;
  sourceId: string;
  fieldMap: StoredDataConnector["fieldMap"];
  hasCredential: boolean;
  lastSyncAt?: string;
  lastSync?: Record<string, unknown>;
}

const toDto = (c: StoredDataConnector): ConnectorDto => ({
  id: c.id, name: c.name, kind: c.kind, kindLabel: CONNECTOR_LABEL[c.kind], serverUrl: c.serverUrl, sourceId: c.sourceId, fieldMap: c.fieldMap,
  hasCredential: Boolean(c.credentialEnc), ...(c.lastSyncAt ? { lastSyncAt: c.lastSyncAt.toISOString() } : {}), ...(c.lastSync ? { lastSync: c.lastSync } : {}),
});

const REFUSAL: Record<Exclude<ConnectorFetch, { ok: true }>["reason"], string> = {
  UNREACHABLE: "The other tool could not be reached. Check the server address.",
  TIMEOUT: "The other tool did not answer in time. Try again in a moment.",
  UNAUTHORIZED: "The other tool refused the key. Check that it is correct and may read this form's data.",
  NOT_FOUND: "The other tool does not know that form. Check the form id and the server.",
  TOO_BIG: "The other tool sent more than can be read in one go. Sync again to bring in the rest.",
  BAD_REPLY: "The other tool answered in a way DonorDesk does not understand.",
  UNSAFE_ADDRESS: "That server address points inside a private network, so it was not contacted.",
  SERVER_ERROR: "The other tool had a problem answering. Try again later.",
};

export class ListConnectorsHandler {
  constructor(private readonly repo: IDataConnectorRepository, private readonly secrets: IConnectorSecrets) {}

  async handle(ctx: AuthenticatedContext, formId: string): Promise<Result<{ connectors: ConnectorDto[]; available: boolean }, DomainError>> {
    if (!can(ctx)) return forbidden();
    const listed = await this.repo.listByForm(formId, ctx.tenant.tenantId);
    if (!listed.ok) return listed;
    return ok({ connectors: listed.value.map(toDto), available: this.secrets.available });
  }
}

export class SaveConnectorHandler {
  constructor(private readonly ids: IIdGenerator, private readonly forms: ICollectionFormRepository, private readonly repo: IDataConnectorRepository, private readonly secrets: IConnectorSecrets, private readonly audit: IAuditLogger, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, formId: string, input: SaveConnectorInput, connectorId?: string): Promise<Result<{ id: string }, DomainError>> {
    if (!can(ctx)) return forbidden();
    if (!this.secrets.available) return fail(DomainError.conflict("Connectors are not set up on this server yet, so a key cannot be kept safely. Ask whoever runs DonorDesk to set it up."));
    const form = await this.forms.findById(formId, ctx.tenant.tenantId);
    if (!form.ok) return form;
    if (!form.value) return fail(DomainError.notFound("Form", formId));
    const config: ConnectorConfig = { kind: input.kind, serverUrl: input.serverUrl, sourceId: input.sourceId, fieldMap: input.fieldMap };
    const problems = connectorProblems(config, form.value.definition);
    if (problems.length > 0) return fail(DomainError.validation(problems[0]!, { problems }));

    const existing = connectorId ? await this.repo.findById(connectorId, ctx.tenant.tenantId) : null;
    if (existing && !existing.ok) return existing;
    if (connectorId && !existing?.ok) return fail(DomainError.notFound("Connector", connectorId));
    const current = existing?.ok ? existing.value : null;
    if (connectorId && (!current || current.formId !== formId)) return fail(DomainError.notFound("Connector", connectorId));
    if (!current && !input.credential) return fail(DomainError.validation("Give the key the other tool issued."));

    const base = {
      name: input.name, kind: input.kind, serverUrl: input.serverUrl.trim(), sourceId: input.sourceId.trim(), fieldMap: input.fieldMap,
      ...(input.credential ? { credentialEnc: this.secrets.encrypt(input.credential) } : current?.credentialEnc ? { credentialEnc: current.credentialEnc } : {}),
    };
    if (!current) {
      const id = this.ids.generate();
      const saved = await this.repo.create({ id, tenantId: ctx.tenant.tenantId, formId, projectId: form.value.projectId, ...base, createdById: ctx.tenant.userId, createdAt: this.clock.now() });
      if (!saved.ok) return saved;
      await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "connector.created", entityType: "data_connector", entityId: id, projectId: form.value.projectId });
      return ok({ id });
    }
    // Pointing the connector at a different survey or server starts from the beginning: what was brought in before came from elsewhere.
    const moved = current.kind !== input.kind || current.serverUrl !== base.serverUrl || current.sourceId !== base.sourceId;
    const { cursor: _cursor, ...rest } = current;
    const saved = await this.repo.update({ ...rest, ...base, ...(moved ? {} : current.cursor ? { cursor: current.cursor } : {}) });
    if (!saved.ok) return saved;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "connector.updated", entityType: "data_connector", entityId: current.id, projectId: current.projectId });
    return ok({ id: current.id });
  }
}

export class DeleteConnectorHandler {
  constructor(private readonly repo: IDataConnectorRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, connectorId: string): Promise<Result<void, DomainError>> {
    if (!can(ctx)) return forbidden();
    const found = await this.repo.findById(connectorId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return fail(DomainError.notFound("Connector", connectorId));
    const removed = await this.repo.delete(connectorId, ctx.tenant.tenantId);
    if (!removed.ok) return removed;
    // The records already brought in stay: they are the organisation's evidence of what was collected.
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "connector.deleted", entityType: "data_connector", entityId: connectorId, projectId: found.value.projectId });
    return ok(undefined);
  }
}

export interface SyncResult extends SyncSummary {
  applied: boolean;
  /** True when more submissions are waiting than one sync reads; sync again. */
  more: boolean;
}

export class SyncConnectorHandler {
  constructor(
    private readonly forms: ICollectionFormRepository,
    private readonly records: ICollectionRecordRepository,
    private readonly repo: IDataConnectorRepository,
    private readonly secrets: IConnectorSecrets,
    private readonly http: IConnectorHttp,
    private readonly audit: IAuditLogger,
    private readonly clock: IClock,
  ) {}

  /** `apply: false` reads and checks but stores nothing and moves nothing: "Check the connection". */
  async handle(ctx: AuthenticatedContext, connectorId: string, input: { apply: boolean }): Promise<Result<SyncResult, DomainError>> {
    if (!can(ctx)) return forbidden();
    const found = await this.repo.findById(connectorId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    const connector = found.value;
    if (!connector) return fail(DomainError.notFound("Connector", connectorId));
    if (!connector.credentialEnc || !this.secrets.available) return fail(DomainError.conflict("This connector has no key kept for it. Edit it and enter the key again."));
    const form = await this.forms.findById(connector.formId, ctx.tenant.tenantId);
    if (!form.ok) return form;
    if (!form.value) return fail(DomainError.notFound("Form", connector.formId));
    if (input.apply && form.value.status !== "PUBLISHED") return fail(DomainError.conflict("Publish the form before bringing submissions in."));

    let credential: string;
    try { credential = this.secrets.decrypt(connector.credentialEnc); } catch { return fail(DomainError.conflict("The saved key could not be read. Edit the connector and enter the key again.")); }
    const config: ConnectorConfig = { kind: connector.kind, serverUrl: connector.serverUrl, sourceId: connector.sourceId, fieldMap: connector.fieldMap };

    const summary = emptySummary();
    const rows: ExternalRow[] = [];
    let more = false;
    for (let page = 0; page < MAX_PAGES_PER_SYNC; page += 1) {
      const request = connectorRequest(config, credential, connector.cursor, rows.length);
      if (!request.ok) return request;
      const got = await this.http.get(request.value.url, request.value.headers);
      if (!got.ok) {
        const message = REFUSAL[got.reason];
        if (input.apply) await this.repo.update({ ...connector, lastSyncAt: this.clock.now(), lastSync: { error: message } });
        return fail(DomainError.conflict(message));
      }
      const parsed = parseExternalPage(connector.kind, got.json);
      summary.skipped += parsed.skipped;
      rows.push(...parsed.page.rows);
      if (!parsed.page.hasMore) break;
      if (page === MAX_PAGES_PER_SYNC - 1) more = true;
    }

    rows.sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
    summary.read = rows.length;
    const now = this.clock.now();
    // The cursor stops before the first row the form refused, so fixing the mapping and syncing again brings that row in.
    let cursor = connector.cursor;
    let blocked = false;
    for (const row of rows) {
      const mapped = mapExternalRow(row, connector.fieldMap, form.value.definition);
      if (mapped.problems.length > 0) {
        summary.rejected += 1;
        blocked = true;
        if (summary.problems.length < MAX_REPORTED_PROBLEMS) summary.problems.push(`Submission ${row.externalId.slice(0, 18)}: ${mapped.problems[0]}`);
        continue;
      }
      const id = connectorRecordId(connector.id, row.externalId);
      if (input.apply) {
        const stored = await this.records.createOnce({
          id, tenantId: ctx.tenant.tenantId, formId: connector.formId, projectId: connector.projectId, answers: mapped.stored,
          submittedOn: toPlainDate(new Date(row.submittedAt)) ?? toPlainDate(now)!, source: "CONNECTOR", submitterName: `${CONNECTOR_LABEL[connector.kind]}: ${connector.name}`, status: "PENDING", createdAt: now,
        });
        if (!stored.ok) return stored;
        if (stored.value.created) summary.created += 1; else summary.alreadyHad += 1;
      } else {
        const had = await this.records.findById(id, ctx.tenant.tenantId);
        if (!had.ok) return had;
        if (had.value) summary.alreadyHad += 1; else summary.created += 1;
      }
      if (!blocked) cursor = row.submittedAt;
    }

    if (input.apply) {
      const { cursor: _old, ...rest } = connector;
      await this.repo.update({ ...rest, ...(cursor ? { cursor } : {}), lastSyncAt: now, lastSync: { ...summary, more } });
      await this.audit.record({
        tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "connector.synced", entityType: "data_connector", entityId: connector.id, projectId: connector.projectId,
        newValue: JSON.stringify({ read: summary.read, created: summary.created, rejected: summary.rejected }),
      });
    }
    return ok({ ...summary, applied: input.apply, more });
  }
}
