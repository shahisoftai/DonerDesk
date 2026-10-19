import { AUTOMATION_RULE_KEYS, AUTOMATION_RULES, DomainError, checkRuleSettings, err, ok, type AutomationRuleKey, type PlainDate, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IAuditLogger, IClock } from "../../ports/core.js";
import type { IAutomationHistory, IAutomationRuleSettings, IPlannedActivityRepository } from "../../ports/workplan.js";
import { PlanAccess } from "../../services/plan-access.js";

const isRuleKey = (key: string): key is AutomationRuleKey => (AUTOMATION_RULE_KEYS as string[]).includes(key);

/** Sets the numbers one rule runs with for a project. Managers only; every value is checked against the rule's own range; audited. */
export class SetAutomationRuleSettingsHandler {
  constructor(private readonly settings: IAutomationRuleSettings, private readonly audit: IAuditLogger, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, projectId: string, ruleKey: string, values: Record<string, unknown>): Promise<Result<Record<string, number>, DomainError>> {
    const allowed = PlanAccess.requireManage(ctx);
    if (!allowed.ok) return allowed;
    if (!isRuleKey(ruleKey)) return err(DomainError.notFound("Automation rule", ruleKey));
    const checked = checkRuleSettings(ruleKey, values);
    if (!checked.ok) return checked;
    const saved = await this.settings.setSettings(projectId, ruleKey, checked.value, { userId: ctx.tenant.userId, now: this.clock.now() }, ctx.tenant.tenantId);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "workplan.automation_settings_set", entityType: "project", entityId: projectId, projectId,
      newValue: JSON.stringify({ ruleKey, values: checked.value }),
    });
    return ok(checked.value);
  }
}

export interface AutomationHistoryLine { sentOn: PlainDate; rule: string; activity: string; recipientId: string }

/** What the automations sent for a project, newest first, with the rule's words and the activity's title. Managers only. */
export class GetAutomationHistoryHandler {
  constructor(private readonly history: IAutomationHistory, private readonly items: IPlannedActivityRepository) {}

  async handle(ctx: AuthenticatedContext, projectId: string, limit = 50): Promise<Result<AutomationHistoryLine[], DomainError>> {
    const allowed = PlanAccess.requireManage(ctx);
    if (!allowed.ok) return allowed;
    const rows = await this.history.recent(projectId, ctx.tenant.tenantId, Math.min(Math.max(limit, 1), 200));
    if (!rows.ok) return rows;
    const items = await this.items.findByProject(projectId, ctx.tenant.tenantId);
    if (!items.ok) return items;
    const titles = new Map(items.value.map((i) => [i.id, i.title]));
    return ok(rows.value
      .filter((r) => isRuleKey(r.ruleKey))
      .map((r) => ({ sentOn: r.sentOn, rule: AUTOMATION_RULES[r.ruleKey as AutomationRuleKey].label, activity: titles.get(r.itemId) ?? "An activity that was removed", recipientId: r.recipientId })));
  }
}
