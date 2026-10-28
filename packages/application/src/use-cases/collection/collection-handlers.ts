import { createHash, randomBytes } from "node:crypto";
import {
  DomainError, Permissions, aggregateRecords, conditionHolds, parseRecordSheet, recordSheetErrorFile, recordSheetTemplate, recordMappingProblems, toPlainDate, validateFormDefinition, validateSubmission, visibleFields,
  type FormDefinition, type FormField, type RecordAggregation, type RecordMapping, type Result, type Role, type TenantId,
} from "@donordesk/domain";
import type { ApplyRecordsInput, CreateCollectionLinkInput, PublicSubmitInput, ReviewRecordInput, SaveCollectionFormInput, SubmitRecordInput } from "@donordesk/contracts";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import type { IIndicatorRepository, IIndicatorUpdateRepository } from "../../ports/logframe.js";
import type { IReportingPeriodRepository } from "../../ports/reporting.js";
import type {
  CollectionFormStatus, ICollectionFormRepository, ICollectionLinkRepository, ICollectionRecordRepository, StoredCollectionForm, StoredCollectionLink, StoredCollectionRecord,
} from "../../ports/collection.js";
import type { BulkUpsertIndicatorUpdatesHandler } from "../logframe/bulk-upsert-indicator-updates.js";

/**
 * Collection forms that feed indicators (Phase 33.5). A form is designed as a draft (`project.edit`), published (its fields are then
 * frozen), filled by members (`indicator.update`) or by anyone holding a collection link, and every submission waits for a person
 * with `indicator.verify` to accept or reject it. Only accepted records are counted into indicator values, and they arrive as
 * drafts through the same bulk save as typed values, so every window, lock and review rule still applies.
 */

const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");
const can = (ctx: AuthenticatedContext, permission: Parameters<typeof Permissions.can>[1]) => Permissions.can(ctx.tenant.role as Role, permission);
const fail = <T>(error: DomainError): Result<T, DomainError> => ({ ok: false, error });
const ok = <T>(value: T): Result<T, DomainError> => ({ ok: true, value });

export interface CollectionFormDto {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  status: CollectionFormStatus;
  fields: FormField[];
  mappings: RecordMapping[];
  counts: { PENDING: number; ACCEPTED: number; REJECTED: number };
  updatedAt: string;
}

export interface CollectionRecordDto {
  id: string;
  formId: string;
  answers: Record<string, unknown>;
  submittedOn: string;
  source: "USER" | "LINK";
  submitter: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  reviewNote?: string;
}

function toDto(form: StoredCollectionForm, counts: CollectionFormDto["counts"]): CollectionFormDto {
  return {
    id: form.id, projectId: form.projectId, name: form.name, ...(form.description ? { description: form.description } : {}), status: form.status,
    fields: [...form.definition.fields], mappings: form.mappings, counts, updatedAt: form.updatedAt.toISOString(),
  };
}

function toRecordDto(r: StoredCollectionRecord, names: Map<string, string>): CollectionRecordDto {
  return {
    id: r.id, formId: r.formId, answers: r.answers, submittedOn: r.submittedOn, source: r.source,
    submitter: r.submitterName ?? (r.submittedById ? names.get(r.submittedById) ?? "A team member" : "Someone with the link"),
    status: r.status, ...(r.reviewNote ? { reviewNote: r.reviewNote } : {}),
  };
}

function definitionFrom(input: SaveCollectionFormInput): FormDefinition {
  return { fields: input.fields as unknown as FormField[] };
}

/** Everything wrong with a form being saved, in one list of sentences. */
function formProblems(input: SaveCollectionFormInput): string[] {
  const definition = definitionFrom(input);
  const problems = validateFormDefinition(definition).map((p) => (p.field ? `${p.field}: ${p.message}` : p.message));
  for (const m of input.mappings) problems.push(...recordMappingProblems(m as RecordMapping, definition.fields));
  return problems;
}

async function loadForm(repo: ICollectionFormRepository, id: string, tenantId: TenantId): Promise<Result<StoredCollectionForm, DomainError>> {
  const found = await repo.findById(id, tenantId);
  if (!found.ok) return found;
  if (!found.value) return fail(DomainError.notFound("Form", id));
  return ok(found.value);
}

export class ListCollectionFormsHandler {
  constructor(private readonly forms: ICollectionFormRepository, private readonly records: ICollectionRecordRepository) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<CollectionFormDto[], DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot see forms"));
    const listed = await this.forms.listByProject(projectId, ctx.tenant.tenantId);
    if (!listed.ok) return listed;
    const out: CollectionFormDto[] = [];
    for (const f of listed.value) {
      const counts = await this.records.countByStatus(f.id, ctx.tenant.tenantId);
      if (!counts.ok) return counts;
      out.push(toDto(f, counts.value));
    }
    return ok(out);
  }
}

export class GetCollectionFormHandler {
  constructor(private readonly forms: ICollectionFormRepository, private readonly records: ICollectionRecordRepository) {}

  async handle(ctx: AuthenticatedContext, formId: string): Promise<Result<CollectionFormDto, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot see forms"));
    const form = await loadForm(this.forms, formId, ctx.tenant.tenantId);
    if (!form.ok) return form;
    const counts = await this.records.countByStatus(formId, ctx.tenant.tenantId);
    if (!counts.ok) return counts;
    return ok(toDto(form.value, counts.value));
  }
}

export class SaveCollectionFormHandler {
  constructor(private readonly ids: IIdGenerator, private readonly forms: ICollectionFormRepository, private readonly indicators: IIndicatorRepository, private readonly audit: IAuditLogger, private readonly clock: IClock) {}

  /** Creates a draft (no `formId`) or replaces a draft's design. A published form is not edited: close it and make a new one. */
  async handle(ctx: AuthenticatedContext, input: SaveCollectionFormInput, formId?: string): Promise<Result<{ id: string }, DomainError>> {
    if (!can(ctx, "project.edit")) return fail(DomainError.forbidden("You cannot design forms"));
    const problems = formProblems(input);
    if (problems.length > 0) return fail(DomainError.validation(problems[0]!, { problems }));
    const indicators = await this.indicators.findByProject(input.projectId, ctx.tenant.tenantId);
    if (!indicators.ok) return indicators;
    const known = new Set(indicators.value.map((i) => i.id));
    for (const m of input.mappings) if (!known.has(m.indicatorId)) return fail(DomainError.validation("A mapping names an indicator that is not in this project."));

    const now = this.clock.now();
    const base = { name: input.name.trim(), ...(input.description?.trim() ? { description: input.description.trim() } : {}), definition: definitionFrom(input), mappings: input.mappings as RecordMapping[] };
    if (!formId) {
      const id = this.ids.generate();
      const created = await this.forms.create({ id, tenantId: ctx.tenant.tenantId, projectId: input.projectId, ...base, status: "DRAFT", createdById: ctx.tenant.userId, createdAt: now, updatedAt: now });
      if (!created.ok) return created;
      await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "collection.form.created", entityType: "collection_form", entityId: id, projectId: input.projectId });
      return ok({ id });
    }
    const existing = await loadForm(this.forms, formId, ctx.tenant.tenantId);
    if (!existing.ok) return existing;
    if (existing.value.projectId !== input.projectId) return fail(DomainError.validation("A form cannot move to another project."));
    if (existing.value.status !== "DRAFT") return fail(DomainError.conflict("A published form cannot be edited. Close it and make a new one so earlier records keep the questions they were answered with."));
    const { description: _drop, ...without } = existing.value;
    const saved = await this.forms.update({ ...without, ...base, updatedAt: now });
    if (!saved.ok) return saved;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "collection.form.updated", entityType: "collection_form", entityId: formId, projectId: input.projectId });
    return ok({ id: formId });
  }
}

export class SetCollectionFormStatusHandler {
  constructor(private readonly forms: ICollectionFormRepository, private readonly audit: IAuditLogger, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, formId: string, to: "PUBLISHED" | "CLOSED"): Promise<Result<void, DomainError>> {
    if (!can(ctx, "project.edit")) return fail(DomainError.forbidden("You cannot publish or close forms"));
    const form = await loadForm(this.forms, formId, ctx.tenant.tenantId);
    if (!form.ok) return form;
    if (to === "PUBLISHED") {
      if (form.value.status !== "DRAFT") return fail(DomainError.conflict("Only a draft can be published."));
      const problems = validateFormDefinition(form.value.definition);
      if (problems.length > 0) return fail(DomainError.validation(problems[0]!.message));
      if (form.value.mappings.length === 0) return fail(DomainError.validation("Say which indicator this form feeds before publishing it."));
    } else if (form.value.status !== "PUBLISHED") return fail(DomainError.conflict("Only a published form can be closed."));
    const saved = await this.forms.update({ ...form.value, status: to, updatedAt: this.clock.now() });
    if (!saved.ok) return saved;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: `collection.form.${to === "PUBLISHED" ? "published" : "closed"}`, entityType: "collection_form", entityId: formId, projectId: form.value.projectId });
    return ok(undefined);
  }
}

/** Shared by the member and public paths: validate against the form, then store once under the client's own id. */
async function storeSubmission(
  repo: ICollectionRecordRepository, ids: IIdGenerator, clock: IClock, form: StoredCollectionForm,
  who: { source: "USER" | "LINK"; userId?: string; name?: string },
  input: SubmitRecordInput,
): Promise<Result<{ id: string; duplicate: boolean; ignored: string[] }, DomainError>> {
  if (form.status !== "PUBLISHED") return fail(DomainError.conflict("This form is not open for answers."));
  const checked = validateSubmission(form.definition, input.answers);
  if (checked.problems.length > 0) return fail(DomainError.validation(checked.problems[0]!.message, { problems: checked.problems }));
  const now = clock.now();
  const stored = await repo.createOnce({
    id: input.id ?? ids.generate(), tenantId: form.tenantId, formId: form.id, projectId: form.projectId, answers: checked.values,
    submittedOn: toPlainDate(now)!, source: who.source, ...(who.userId ? { submittedById: who.userId } : {}), ...(who.name ? { submitterName: who.name } : {}),
    status: "PENDING", createdAt: now,
  });
  if (!stored.ok) return stored;
  return ok({ id: stored.value.record.id, duplicate: !stored.value.created, ignored: checked.ignored });
}

export class SubmitCollectionRecordHandler {
  constructor(private readonly ids: IIdGenerator, private readonly forms: ICollectionFormRepository, private readonly records: ICollectionRecordRepository, private readonly audit: IAuditLogger, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, formId: string, input: SubmitRecordInput): Promise<Result<{ id: string; duplicate: boolean; ignored: string[] }, DomainError>> {
    if (!can(ctx, "indicator.update")) return fail(DomainError.forbidden("You cannot submit records"));
    const form = await loadForm(this.forms, formId, ctx.tenant.tenantId);
    if (!form.ok) return form;
    const stored = await storeSubmission(this.records, this.ids, this.clock, form.value, { source: "USER", userId: ctx.tenant.userId }, input);
    if (stored.ok && !stored.value.duplicate) {
      await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "collection.record.submitted", entityType: "collection_record", entityId: stored.value.id, projectId: form.value.projectId });
    }
    return stored;
  }
}

export class ListCollectionRecordsHandler {
  constructor(private readonly forms: ICollectionFormRepository, private readonly records: ICollectionRecordRepository, private readonly names: (tenantId: TenantId) => Promise<Map<string, string>>) {}

  async handle(ctx: AuthenticatedContext, formId: string, status?: "PENDING" | "ACCEPTED" | "REJECTED"): Promise<Result<CollectionRecordDto[], DomainError>> {
    if (!can(ctx, "indicator.update") && !can(ctx, "indicator.verify")) return fail(DomainError.forbidden("You cannot see collected records"));
    const form = await loadForm(this.forms, formId, ctx.tenant.tenantId);
    if (!form.ok) return form;
    const listed = await this.records.listByForm(formId, ctx.tenant.tenantId, status);
    if (!listed.ok) return listed;
    const names = await this.names(ctx.tenant.tenantId);
    return ok(listed.value.map((r) => toRecordDto(r, names)));
  }
}

export class ReviewCollectionRecordHandler {
  constructor(private readonly records: ICollectionRecordRepository, private readonly audit: IAuditLogger, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, recordId: string, input: ReviewRecordInput): Promise<Result<void, DomainError>> {
    if (!can(ctx, "indicator.verify")) return fail(DomainError.forbidden("You cannot review collected records"));
    const found = await this.records.findById(recordId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return fail(DomainError.notFound("Record", recordId));
    if (input.decision === "REJECT" && !input.note?.trim()) return fail(DomainError.validation("Say why this record is rejected."));
    const record = found.value;
    if (input.decision === "REOPEN") {
      // A reviewed record goes back to waiting; totals read only accepted records, so they follow at once.
      if (record.status === "PENDING") return fail(DomainError.conflict("This record is already waiting for review."));
      const { reviewNote: _n, reviewedById: _r, reviewedAt: _a, ...rest } = record;
      const reopened = await this.records.update({ ...rest, status: "PENDING" });
      if (!reopened.ok) return reopened;
      await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "collection.record.reopened", entityType: "collection_record", entityId: recordId, projectId: record.projectId });
      return ok(undefined);
    }
    const next = input.decision === "ACCEPT" ? "ACCEPTED" : "REJECTED";
    const saved = await this.records.update({ ...record, status: next, reviewedById: ctx.tenant.userId, reviewedAt: this.clock.now(), ...(input.note?.trim() ? { reviewNote: input.note.trim() } : {}) });
    if (!saved.ok) return saved;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: `collection.record.${next.toLowerCase()}`, entityType: "collection_record", entityId: recordId, projectId: record.projectId });
    return ok(undefined);
  }
}

export interface CollectionLinkDto { id: string; label: string; expiresAt: string; live: boolean; revoked: boolean }

export class CreateCollectionLinkHandler {
  constructor(private readonly ids: IIdGenerator, private readonly forms: ICollectionFormRepository, private readonly links: ICollectionLinkRepository, private readonly audit: IAuditLogger, private readonly clock: IClock) {}

  /** The token is shown once; only its hash is stored. */
  async handle(ctx: AuthenticatedContext, formId: string, input: CreateCollectionLinkInput): Promise<Result<{ id: string; token: string; expiresAt: string }, DomainError>> {
    if (!can(ctx, "project.edit")) return fail(DomainError.forbidden("You cannot create collection links"));
    const form = await loadForm(this.forms, formId, ctx.tenant.tenantId);
    if (!form.ok) return form;
    if (form.value.status !== "PUBLISHED") return fail(DomainError.conflict("Publish the form before sharing it."));
    const now = this.clock.now();
    const token = randomBytes(24).toString("base64url");
    const link: StoredCollectionLink = {
      id: this.ids.generate(), tenantId: ctx.tenant.tenantId, formId, label: input.label, tokenHash: sha256(token),
      expiresAt: new Date(now.getTime() + input.expiresInDays * 86_400_000), createdById: ctx.tenant.userId, createdAt: now,
    };
    const saved = await this.links.create(link);
    if (!saved.ok) return saved;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "collection.link.created", entityType: "collection_link", entityId: link.id, projectId: form.value.projectId });
    return ok({ id: link.id, token, expiresAt: link.expiresAt.toISOString() });
  }
}

export class ListCollectionLinksHandler {
  constructor(private readonly links: ICollectionLinkRepository, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, formId: string): Promise<Result<CollectionLinkDto[], DomainError>> {
    if (!can(ctx, "project.edit")) return fail(DomainError.forbidden("You cannot see collection links"));
    const listed = await this.links.listByForm(formId, ctx.tenant.tenantId);
    if (!listed.ok) return listed;
    const now = this.clock.now();
    return ok(listed.value.map((l) => ({ id: l.id, label: l.label, expiresAt: l.expiresAt.toISOString(), revoked: l.revokedAt !== undefined, live: l.revokedAt === undefined && l.expiresAt > now })));
  }
}

export class RevokeCollectionLinkHandler {
  constructor(private readonly links: ICollectionLinkRepository, private readonly audit: IAuditLogger, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, linkId: string): Promise<Result<void, DomainError>> {
    if (!can(ctx, "project.edit")) return fail(DomainError.forbidden("You cannot revoke collection links"));
    const found = await this.links.findById(linkId, ctx.tenant.tenantId);
    if (!found.ok) return found;
    if (!found.value) return fail(DomainError.notFound("Link", linkId));
    const saved = await this.links.revoke(linkId, ctx.tenant.tenantId, this.clock.now());
    if (!saved.ok) return saved;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "collection.link.revoked", entityType: "collection_link", entityId: linkId });
    return ok(undefined);
  }
}

/**
 * The public side of a collection link. The visitor has no session: the token names the form. Unknown, expired, revoked and
 * closed-form tokens are all "not available", so a link cannot be probed. Runs on the organisation's own container once the
 * admin one has found which organisation the token belongs to.
 */
export class ResolveCollectionLinkHandler {
  constructor(private readonly links: ICollectionLinkRepository, private readonly clock: IClock) {}

  async handle(token: string): Promise<Result<{ tenantId: TenantId; formId: string; linkId: string }, DomainError>> {
    const found = await this.links.findByTokenHash(sha256(token));
    if (!found.ok) return found;
    const link = found.value;
    if (!link || link.revokedAt || link.expiresAt <= this.clock.now()) return fail(DomainError.notFound("Link", "unavailable"));
    return ok({ tenantId: link.tenantId, formId: link.formId, linkId: link.id });
  }
}

export class PublicCollectionFormHandler {
  constructor(private readonly forms: ICollectionFormRepository) {}

  /** The questions only: no mappings, no project, no counts. */
  async handle(tenantId: TenantId, formId: string): Promise<Result<{ name: string; description?: string; fields: FormField[] }, DomainError>> {
    const form = await loadForm(this.forms, formId, tenantId);
    if (!form.ok || form.value.status !== "PUBLISHED") return fail(DomainError.notFound("Form", "unavailable"));
    return ok({ name: form.value.name, ...(form.value.description ? { description: form.value.description } : {}), fields: [...form.value.definition.fields] });
  }
}

export class PublicSubmitCollectionRecordHandler {
  constructor(private readonly ids: IIdGenerator, private readonly forms: ICollectionFormRepository, private readonly records: ICollectionRecordRepository, private readonly audit: IAuditLogger, private readonly clock: IClock) {}

  async handle(tenantId: TenantId, formId: string, linkId: string, input: PublicSubmitInput): Promise<Result<{ id: string; duplicate: boolean }, DomainError>> {
    const form = await loadForm(this.forms, formId, tenantId);
    if (!form.ok) return fail(DomainError.notFound("Form", "unavailable"));
    const stored = await storeSubmission(this.records, this.ids, this.clock, form.value, { source: "LINK", ...(input.submitterName ? { name: input.submitterName } : {}) }, input);
    if (!stored.ok) return stored;
    if (!stored.value.duplicate) {
      await this.audit.record({ tenantId, actorId: `link:${linkId}`, eventType: "collection.record.submitted", entityType: "collection_record", entityId: stored.value.id, projectId: form.value.projectId });
    }
    return ok({ id: stored.value.id, duplicate: stored.value.duplicate });
  }
}

export interface RecordTotalsDto {
  indicatorId: string;
  indicatorCode: string;
  method: "COUNT" | "SUM";
  periods: Array<{ periodId: string; label: string; value: string; recordCount: number }>;
  outsidePeriods: number;
  missingFigure: number;
  duplicates: number;
}

/** What the accepted records add up to, per mapped indicator and period (read-only; nothing is written). */
export class PreviewCollectionTotalsHandler {
  constructor(private readonly forms: ICollectionFormRepository, private readonly records: ICollectionRecordRepository, private readonly indicators: IIndicatorRepository, private readonly periods: IReportingPeriodRepository) {}

  async compute(ctx: AuthenticatedContext, formId: string): Promise<Result<{ form: StoredCollectionForm; totals: Array<{ mapping: RecordMapping; code: string; aggregation: RecordAggregation; periods: Array<{ id: string; label: string }> }> }, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot see collected totals"));
    const form = await loadForm(this.forms, formId, ctx.tenant.tenantId);
    if (!form.ok) return form;
    const [accepted, indicators, periods] = await Promise.all([
      this.records.listByForm(formId, ctx.tenant.tenantId, "ACCEPTED"),
      this.indicators.findByProject(form.value.projectId, ctx.tenant.tenantId),
      this.periods.findByProject(form.value.projectId, ctx.tenant.tenantId),
    ]);
    if (!accepted.ok) return accepted;
    if (!indicators.ok) return indicators;
    if (!periods.ok) return periods;
    const codes = new Map(indicators.value.map((i) => [i.id, i.code]));
    const spans = periods.value.map((p) => ({ id: p.id, start: toPlainDate(p.duration.start)!, end: toPlainDate(p.duration.end)!, label: p.duration.start.toISOString().slice(0, 10) + " – " + p.duration.end.toISOString().slice(0, 10) }));
    const collected = accepted.value.map((r) => ({ id: r.id, submittedOn: r.submittedOn, answers: r.answers }));
    return ok({
      form: form.value,
      periods: spans,
      totals: form.value.mappings.map((mapping) => ({ mapping, code: codes.get(mapping.indicatorId) ?? mapping.indicatorId, aggregation: aggregateRecords(collected, mapping, spans), periods: spans })),
    } as never);
  }

  async handle(ctx: AuthenticatedContext, formId: string): Promise<Result<RecordTotalsDto[], DomainError>> {
    const computed = await this.compute(ctx, formId);
    if (!computed.ok) return computed;
    return ok(computed.value.totals.map((t) => ({
      indicatorId: t.mapping.indicatorId, indicatorCode: t.code, method: t.mapping.method,
      periods: t.aggregation.periods.map((p) => ({ periodId: p.periodId, label: t.periods.find((x) => x.id === p.periodId)?.label ?? p.periodId, value: p.value, recordCount: p.recordCount })),
      outsidePeriods: t.aggregation.outsidePeriods.length, missingFigure: t.aggregation.missingFigure.length, duplicates: t.aggregation.duplicates.length,
    })));
  }
}

/** Writes the accepted records' totals for one period into the indicator grid as drafts (verified values are left as they are). */
export class ApplyCollectionTotalsHandler {
  constructor(
    private readonly totals: PreviewCollectionTotalsHandler,
    private readonly updates: IIndicatorUpdateRepository,
    private readonly bulk: BulkUpsertIndicatorUpdatesHandler,
  ) {}

  async handle(ctx: AuthenticatedContext, formId: string, input: ApplyRecordsInput): Promise<Result<{ saved: number; skipped: number; indicators: string[] }, DomainError>> {
    if (!can(ctx, "indicator.update")) return fail(DomainError.forbidden("You cannot enter indicator values"));
    const computed = await this.totals.compute(ctx, formId);
    if (!computed.ok) return computed;
    const rows = [];
    const codes: string[] = [];
    for (const t of computed.value.totals) {
      const forPeriod = t.aggregation.periods.find((p) => p.periodId === input.reportingPeriodId);
      if (!forPeriod || forPeriod.value === "") continue;
      const existing = await this.updates.findByIndicatorAndPeriod(t.mapping.indicatorId, input.reportingPeriodId, ctx.tenant.tenantId);
      if (!existing.ok) return existing;
      rows.push({
        indicatorId: t.mapping.indicatorId, periodAchievement: forPeriod.value, cumulativeAchievement: existing.value?.cumulativeAchievement ?? "",
        dataSource: `Collected through "${computed.value.form.name}" (${forPeriod.recordCount} record${forPeriod.recordCount === 1 ? "" : "s"})`,
      });
      codes.push(t.code);
    }
    if (rows.length === 0) return fail(DomainError.validation("No accepted records fall in this period, so there is nothing to enter."));
    const saved = await this.bulk.handle(ctx, { reportingPeriodId: input.reportingPeriodId, updates: rows });
    if (!saved.ok) return saved;
    return ok({ saved: saved.value.saved, skipped: saved.value.skipped, indicators: codes });
  }
}

// Re-exported so the web form can ask the same rule the server enforces.
export { conditionHolds, visibleFields };

export interface RecordImportPreview {
  total: number;
  valid: number;
  invalid: number;
  unknownColumns: string[];
  missingColumns: string[];
  rows: Array<{ rowNumber: number; problems: string[]; ignored: string[] }>;
  /** The person's own sheet with a Problems column, only the rows to fix; absent when every row is fine. */
  errorFile?: string;
  /** How many records were stored (0 for a preview, or when nothing was imported). */
  saved: number;
}

/** The form's own blank sheet: one column per question, named by its label. */
export class GetCollectionSheetTemplateHandler {
  constructor(private readonly forms: ICollectionFormRepository) {}

  async handle(ctx: AuthenticatedContext, formId: string): Promise<Result<{ fileName: string; text: string }, DomainError>> {
    if (!can(ctx, "project.view")) return fail(DomainError.forbidden("You cannot see forms"));
    const form = await loadForm(this.forms, formId, ctx.tenant.tenantId);
    if (!form.ok) return form;
    return ok({ fileName: `${form.value.name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "form"}-template.csv`, text: recordSheetTemplate(form.value.definition) });
  }
}

/**
 * Records from a spreadsheet. A preview (`apply: false`) saves nothing; applying needs every row to be right, so one bad row
 * blocks the sheet and the error file says which. Each row is stored under an id made from the sheet and its row number, so
 * applying the same sheet twice stores it once.
 */
export class ImportCollectionRecordsHandler {
  constructor(private readonly ids: IIdGenerator, private readonly forms: ICollectionFormRepository, private readonly records: ICollectionRecordRepository, private readonly audit: IAuditLogger, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, formId: string, input: { text: string; apply: boolean }): Promise<Result<RecordImportPreview, DomainError>> {
    if (!can(ctx, "indicator.update")) return fail(DomainError.forbidden("You cannot submit records"));
    const form = await loadForm(this.forms, formId, ctx.tenant.tenantId);
    if (!form.ok) return form;
    const sheet = parseRecordSheet(form.value.definition, input.text);
    const preview: RecordImportPreview = {
      total: sheet.rows.length, valid: sheet.valid, invalid: sheet.invalid, unknownColumns: sheet.unknownColumns, missingColumns: sheet.missingColumns,
      rows: sheet.rows.filter((r) => r.problems.length > 0 || r.ignored.length > 0).map((r) => ({ rowNumber: r.rowNumber, problems: r.problems, ignored: r.ignored })),
      ...(sheet.invalid > 0 ? { errorFile: recordSheetErrorFile(sheet) } : {}), saved: 0,
    };
    if (!input.apply) return ok(preview);
    if (form.value.status !== "PUBLISHED") return fail(DomainError.conflict("This form is not open for answers."));
    if (sheet.invalid > 0) return fail(DomainError.validation(`${sheet.invalid} row${sheet.invalid === 1 ? " has" : "s have"} a problem, so nothing was imported. Fix them in the error file and import again.`, { preview }));
    if (sheet.rows.length === 0) return fail(DomainError.validation("The sheet has no rows."));

    const sheetKey = createHash("sha256").update(formId + "\n" + input.text).digest("hex").slice(0, 24);
    const now = this.clock.now();
    let saved = 0;
    for (const row of sheet.rows) {
      const stored = await this.records.createOnce({
        id: `imp-${sheetKey}-${row.rowNumber}`, tenantId: form.value.tenantId, formId, projectId: form.value.projectId, answers: row.answers,
        submittedOn: toPlainDate(now)!, source: "USER", submittedById: ctx.tenant.userId, status: "PENDING", createdAt: now,
      });
      if (!stored.ok) return stored;
      if (stored.value.created) saved += 1;
    }
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "collection.records.imported", entityType: "collection_form", entityId: formId, projectId: form.value.projectId, newValue: String(saved) });
    return ok({ ...preview, saved });
  }
}
