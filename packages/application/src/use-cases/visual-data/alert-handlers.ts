import { DomainError, alertInputFromSheet, alertRuleProblems, describeAlert, evaluateAlert, ok, shouldNotify, type AlertRule, type AlertRuleKind, type AlertState, type Result, type TenantId } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock, IIdGenerator } from "../../ports/core.js";
import type { IDataAlertRepository, StoredDataAlert } from "../../ports/data-alerts.js";
import type { IPersonNotifier } from "../../ports/reminders.js";
import type { GetProjectDataSheetHandler } from "../data-center/data-sheet.js";

/** A person's own threshold alerts (Phase 48.16). Always the caller's: no handler takes a user id. */
export interface DataAlertDto { id: string; projectId: string; indicatorId: string; kind: AlertRuleKind; value: number | null; state: AlertState }
const dto = (a: StoredDataAlert): DataAlertDto => ({ id: a.id, projectId: a.projectId, indicatorId: a.indicatorId, kind: a.ruleKind, value: a.ruleValue, state: a.lastState });
export const MAX_ALERTS_PER_PERSON = 30;

export class ListMyAlertsHandler {
  constructor(private readonly repo: IDataAlertRepository) {}
  async handle(ctx: AuthenticatedContext): Promise<Result<{ alerts: DataAlertDto[] }, DomainError>> {
    const r = await this.repo.listForUser(ctx.tenant.tenantId, ctx.tenant.userId);
    return r.ok ? ok({ alerts: r.value.map(dto) }) : r;
  }
}

export class AddAlertHandler {
  constructor(private readonly ids: IIdGenerator, private readonly repo: IDataAlertRepository, private readonly sheets: GetProjectDataSheetHandler, private readonly audit: IAuditLogger, private readonly clock: IClock) {}
  async handle(ctx: AuthenticatedContext, input: { projectId: string; indicatorId: string; kind: AlertRuleKind; value?: number | undefined }): Promise<Result<DataAlertDto, DomainError>> {
    const rule: AlertRule = { kind: input.kind, value: input.value };
    const problems = alertRuleProblems(rule);
    if (problems.length) return { ok: false, error: DomainError.validation(problems[0]!) };
    const mine = await this.repo.listForUser(ctx.tenant.tenantId, ctx.tenant.userId);
    if (!mine.ok) return mine;
    if (mine.value.length >= MAX_ALERTS_PER_PERSON) return { ok: false, error: DomainError.validation(`You can keep ${MAX_ALERTS_PER_PERSON} alerts. Remove one to add another.`) };
    // Reading the sheet as the caller is the visibility check: a project they cannot see answers not found.
    const sheet = await this.sheets.handle(ctx, input.projectId);
    if (!sheet.ok) return sheet;
    if (!sheet.value.indicators.some((i) => i.id === input.indicatorId)) return { ok: false, error: DomainError.notFound("Indicator", input.indicatorId) };
    const a: StoredDataAlert = { id: this.ids.generate(), tenantId: ctx.tenant.tenantId, userId: ctx.tenant.userId, role: String(ctx.tenant.role), projectId: input.projectId, indicatorId: input.indicatorId, ruleKind: input.kind, ruleValue: input.value ?? null, lastState: "OK", createdAt: this.clock.now() };
    const saved = await this.repo.create(a);
    if (!saved.ok) return saved;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "data_alert.added", entityType: "data_alert", entityId: a.id });
    return ok(dto(a));
  }
}

export class RemoveAlertHandler {
  constructor(private readonly repo: IDataAlertRepository, private readonly audit: IAuditLogger) {}
  async handle(ctx: AuthenticatedContext, id: string): Promise<Result<void, DomainError>> {
    const r = await this.repo.delete(id, ctx.tenant.tenantId, ctx.tenant.userId);
    if (!r.ok) return r;
    await this.audit.record({ tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "data_alert.removed", entityType: "data_alert", entityId: id });
    return ok(undefined);
  }
}

export interface AlertRunDto { checked: number; told: number; skipped: number }

/** Called by the hourly run: each alert is read as its owner, and the owner is told once when it crosses into firing. */
export class RunDataAlertsHandler {
  constructor(private readonly repo: IDataAlertRepository, private readonly sheets: GetProjectDataSheetHandler, private readonly notifier: IPersonNotifier, private readonly clock: IClock) {}
  async handle(tenantId: TenantId): Promise<Result<AlertRunDto, DomainError>> {
    const all = await this.repo.listAll(tenantId);
    if (!all.ok) return all;
    const today = this.clock.now().toISOString().slice(0, 10);
    const out: AlertRunDto = { checked: 0, told: 0, skipped: 0 };
    for (const a of all.value) {
      const ctx: AuthenticatedContext = { tenant: { tenantId, userId: a.userId, role: a.role } as never, requestId: "data-alerts" };
      const sheet = await this.sheets.handle(ctx, a.projectId);
      const rule: AlertRule = { kind: a.ruleKind, value: a.ruleValue ?? undefined };
      const input = sheet.ok ? alertInputFromSheet(sheet.value, a.indicatorId, rule, today) : null;
      if (!sheet.ok || !input) { out.skipped += 1; continue; }
      out.checked += 1;
      const state = evaluateAlert(rule, input);
      if (state === a.lastState) continue;
      if (shouldNotify(a.lastState, state)) {
        const name = sheet.value.indicators.find((i) => i.id === a.indicatorId)?.name ?? "An indicator";
        await this.notifier.send({ tenantId, recipientId: a.userId, type: "DATA_ALERT", title: "A figure you watch needs attention", message: describeAlert(rule, name, input), relatedEntityType: "project", relatedEntityId: a.projectId, urgent: false });
        out.told += 1;
      }
      await this.repo.setState(a.id, tenantId, state);
    }
    return ok(out);
  }
}
