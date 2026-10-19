import {
  DomainError, PROGRESS_KIND_LABEL, blankValues, err, ok, overlapping, parseCount, progressFields, progressRange, sourcesFor, sumValues,
  type LiveEntry, type ProgressKind, type ProgressNarrative, type ProgressValues, type Result, type TenantId,
} from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import type { IIndicatorRepository } from "../../ports/logframe.js";
import type { IPlannedActivityIndicatorRepository, IProgressRepository, ProgressEntryRecord } from "../../ports/workplan.js";
import { PlanAccess } from "../../services/plan-access.js";

const NARRATIVE_KEYS = ["notes", "summary", "achievements", "challenges", "nextSteps", "lessons"] as const;

async function fieldsFor(itemId: string, tenantId: TenantId, links: IPlannedActivityIndicatorRepository, indicators: IIndicatorRepository, projectId: string) {
  const ids = await links.findIndicatorIds(itemId, tenantId);
  if (!ids.ok) return ids;
  const all = await indicators.findByProject(projectId, tenantId);
  if (!all.ok) return all;
  const mine = all.value.filter((i) => ids.value.includes(i.id));
  return ok(progressFields(mine.map((i) => ({ code: i.code, targetBreakdowns: i.targetBreakdowns }))));
}

/** Which indicators the activity reports on. The lead or a manager may change it; each must belong to this project. */
export class SetPlanIndicatorsHandler {
  constructor(private readonly access: PlanAccess, private readonly links: IPlannedActivityIndicatorRepository, private readonly indicators: IIndicatorRepository, private readonly audit: IAuditLogger, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, itemId: string, input: { indicatorIds: string[] }): Promise<Result<void, DomainError>> {
    const item = await this.access.load(ctx, itemId, "EDIT_NOTES");
    if (!item.ok) return item;
    const ids = [...new Set(input.indicatorIds)];
    const all = await this.indicators.findByProject(item.value.projectId, ctx.tenant.tenantId);
    if (!all.ok) return all;
    const known = new Set(all.value.map((i) => i.id));
    if (ids.some((id) => !known.has(id))) return err(DomainError.validation("Choose indicators from this project", { field: "indicatorIds" }));
    const saved = await this.links.replace({ tenantId: ctx.tenant.tenantId.toString(), projectId: item.value.projectId, plannedActivityId: itemId, indicatorIds: ids, userId: ctx.tenant.userId, now: this.clock.now() });
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "workplan.indicators_set", entityType: "planned_activity", entityId: itemId,
      projectId: item.value.projectId, newValue: JSON.stringify(ids),
    });
    return ok(undefined);
  }
}

/** The progress log of one planned activity: its breakdown fields, and every entry with its figures. Anyone who can see the plan. */
export class GetProgressHandler {
  constructor(private readonly access: PlanAccess, private readonly progress: IProgressRepository, private readonly links: IPlannedActivityIndicatorRepository, private readonly indicators: IIndicatorRepository) {}

  async handle(ctx: AuthenticatedContext, itemId: string): Promise<Result<{ fields: ReturnType<typeof progressFields>; entries: ProgressEntryRecord[]; indicatorIds: string[] }, DomainError>> {
    const item = await this.access.load(ctx, itemId, "VIEW");
    if (!item.ok) return item;
    const fields = await fieldsFor(itemId, ctx.tenant.tenantId, this.links, this.indicators, item.value.projectId);
    if (!fields.ok) return fields;
    const entries = await this.progress.findByItem(itemId, ctx.tenant.tenantId);
    if (!entries.ok) return entries;
    const linked = await this.links.findIndicatorIds(itemId, ctx.tenant.tenantId);
    if (!linked.ok) return linked;
    return ok({ fields: fields.value, entries: entries.value, indicatorIds: linked.value });
  }
}

export interface SaveProgressInput {
  kind: ProgressKind;
  /** A date (daily, weekly), a month (YYYY-MM), or empty for the activity end. */
  key: string;
  values: { total: string; breakdowns: Record<string, string>; sessions: string; unique: string };
  narrative: Partial<Record<(typeof NARRATIVE_KEYS)[number], string>>;
  /** Set only when changing the entry already logged for this kind and range. Without it, a repeat is refused. */
  replaceId?: string;
}

/** Saves a progress entry. A monthly report absorbs the live daily and weekly entries inside its month. Blank stays blank. */
export class SaveProgressHandler {
  constructor(
    private readonly access: PlanAccess, private readonly progress: IProgressRepository, private readonly links: IPlannedActivityIndicatorRepository,
    private readonly indicators: IIndicatorRepository, private readonly ids: IIdGenerator, private readonly audit: IAuditLogger, private readonly clock: IClock,
  ) {}

  async handle(ctx: AuthenticatedContext, itemId: string, input: SaveProgressInput): Promise<Result<{ id: string; absorbed: number }, DomainError>> {
    const item = await this.access.load(ctx, itemId, "EDIT_NOTES");
    if (!item.ok) return item;
    const act = item.value.snapshot();
    const activity = { start: act.plannedStart, end: act.plannedEnd };
    const fields = await fieldsFor(itemId, ctx.tenant.tenantId, this.links, this.indicators, item.value.projectId);
    if (!fields.ok) return fields;

    const range = progressRange(input.kind, input.key, activity);
    if (!range.ok) return range;
    const live = await this.progress.findByItem(itemId, ctx.tenant.tenantId);
    if (!live.ok) return live;
    const existing = live.value.find((e) => e.kind === input.kind && e.from === range.value.from);
    if (existing?.absorbedById) return err(DomainError.conflict("This day is already in a monthly report. Change that monthly report instead.", { field: "key" }));
    if (existing && existing.id !== input.replaceId) return err(DomainError.conflict(`${input.kind === "MONTHLY" ? "That month" : "That day"} is already logged. Open that entry to change it.`, { field: "key" }));
    const liveEntries: LiveEntry[] = live.value.map((e) => ({ id: e.id, kind: e.kind, from: e.from, to: e.to, values: e.values, absorbedById: e.absorbedById }));
    const clash = overlapping(liveEntries, input.kind, range.value, existing?.id);
    if (clash) return err(DomainError.conflict(`${clash.kind === "MONTHLY" ? "That month" : `${clash.from}`} is already logged. Open that entry to change it.`, { field: "key" }));

    const values = parseValues(input.values, fields.value);
    if (!values.ok) return values;
    const narrative = parseNarrative(input.narrative);
    const anyFigure = values.value.total !== null || values.value.sessions !== null || values.value.unique !== null
      || Object.values(values.value.breakdowns).some((v) => v !== null);
    if (!anyFigure && !Object.values(narrative).some((t) => t !== "")) return err(DomainError.validation("Enter at least one figure, or leave the entry out. A blank entry is not saved.", { field: "total" }));

    const absorbIds = input.kind === "MONTHLY" && !existing
      ? sourcesFor(input.kind, range.value, liveEntries).map((e) => e.id)
      : [];
    const id = existing?.id ?? this.ids.generate();
    const now = this.clock.now();
    const record: ProgressEntryRecord = {
      id, tenantId: ctx.tenant.tenantId.toString(), projectId: item.value.projectId, plannedActivityId: itemId, kind: input.kind,
      from: range.value.from, to: range.value.to, values: values.value, narrative,
      absorbedById: existing?.absorbedById ?? null, createdById: existing?.createdById ?? ctx.tenant.userId, updatedById: ctx.tenant.userId,
      createdAt: existing?.createdAt ?? now, updatedAt: now,
    };
    const saved = await this.progress.save(record, absorbIds);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: existing ? "workplan.progress_changed" : "workplan.progress_logged",
      entityType: "planned_activity", entityId: itemId, projectId: item.value.projectId,
      newValue: JSON.stringify({ kind: PROGRESS_KIND_LABEL[input.kind], from: range.value.from, to: range.value.to, absorbed: absorbIds.length }),
    });
    return ok({ id, absorbed: absorbIds.length });
  }
}

/**
 * What a form opens with for a kind and range: the sum of the live entries it covers (a monthly report: the daily and weekly
 * entries in its month not yet absorbed; the activity end: every live entry). Nothing recorded stays blank (null), never zero.
 */
export class PrepareProgressHandler {
  constructor(private readonly access: PlanAccess, private readonly progress: IProgressRepository, private readonly links: IPlannedActivityIndicatorRepository, private readonly indicators: IIndicatorRepository) {}

  async handle(ctx: AuthenticatedContext, itemId: string, kind: ProgressKind, key: string): Promise<Result<{ from: string; to: string; fields: ReturnType<typeof progressFields>; values: ProgressValues; sources: number }, DomainError>> {
    const item = await this.access.load(ctx, itemId, "VIEW");
    if (!item.ok) return item;
    const act = item.value.snapshot();
    const range = progressRange(kind, key, { start: act.plannedStart, end: act.plannedEnd });
    if (!range.ok) return range;
    const fields = await fieldsFor(itemId, ctx.tenant.tenantId, this.links, this.indicators, item.value.projectId);
    if (!fields.ok) return fields;
    const live = await this.progress.findByItem(itemId, ctx.tenant.tenantId);
    if (!live.ok) return live;
    const open: LiveEntry[] = live.value
      .filter((e) => e.absorbedById === null)
      .map((e) => ({ id: e.id, kind: e.kind, from: e.from, to: e.to, values: e.values, absorbedById: null }));
    const sources = sourcesFor(kind, range.value, open);
    const values = kind === "MONTHLY" || kind === "END" ? sumValues(sources, fields.value) : blankValues(fields.value);
    return ok({ from: range.value.from, to: range.value.to, fields: fields.value, values: { ...values, unique: null }, sources: sources.length });
  }
}

/** Removes a progress entry. A monthly report's removal releases the daily and weekly entries it had absorbed. */
export class RemoveProgressHandler {
  constructor(private readonly access: PlanAccess, private readonly progress: IProgressRepository, private readonly audit: IAuditLogger) {}

  async handle(ctx: AuthenticatedContext, itemId: string, entryId: string): Promise<Result<void, DomainError>> {
    const item = await this.access.load(ctx, itemId, "EDIT_NOTES");
    if (!item.ok) return item;
    const removed = await this.progress.remove(entryId, itemId, ctx.tenant.tenantId);
    if (!removed.ok) return removed;
    if (!removed.value) return err(DomainError.notFound("ProgressEntry", entryId));
    await this.audit.record({
      tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "workplan.progress_removed", entityType: "planned_activity", entityId: itemId,
      projectId: item.value.projectId, newValue: JSON.stringify({ entryId }),
    });
    return ok(undefined);
  }
}

function parseValues(input: SaveProgressInput["values"], fields: ReturnType<typeof progressFields>): Result<ProgressValues> {
  const total = parseCount(input.total);
  if (!total.ok) return total;
  const sessions = parseCount(input.sessions);
  if (!sessions.ok) return sessions;
  const unique = parseCount(input.unique);
  if (!unique.ok) return unique;
  const breakdowns: Record<string, number | null> = blankValues(fields).breakdowns;
  for (const f of fields) {
    const v = parseCount(input.breakdowns[f.key]);
    if (!v.ok) return err(DomainError.validation(`${f.label}: ${v.error.message}`, { field: f.key }));
    breakdowns[f.key] = v.value;
  }
  return ok({ total: total.value, breakdowns, sessions: sessions.value, unique: unique.value });
}

function parseNarrative(input: SaveProgressInput["narrative"]): ProgressNarrative {
  const pick = (k: (typeof NARRATIVE_KEYS)[number]) => (input[k] ?? "").trim();
  return { notes: pick("notes"), summary: pick("summary"), achievements: pick("achievements"), challenges: pick("challenges"), nextSteps: pick("nextSteps"), lessons: pick("lessons") };
}

