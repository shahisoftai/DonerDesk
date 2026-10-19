import { AUTOMATION_RULES, AUTOMATION_RULE_KEYS, automationNotices, evidenceCoverage, noticeSubjectKey, NO_DELIVERY, DomainError, err, ok, type AutomationItem, type AutomationRuleKey, type PlainDate, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IClock } from "../../ports/core.js";
import type { IReminderAudience, IReminderLedger, IPersonNotifier } from "../../ports/reminders.js";
import type { IAutomationSettings, IDeliveryFactsReader, IPlannedActivityRepository } from "../../ports/workplan.js";
import type { IProjectRepository } from "../../ports/projects.js";
import { PlanAccess } from "../../services/plan-access.js";

/** The rules that are on for each project, from the stored choices. */
export const enabledFrom = (stored: Record<string, boolean>): Set<AutomationRuleKey> =>
  new Set(AUTOMATION_RULE_KEYS.filter((k) => stored[k] !== false));

/** Turns one rule on or off for a project. Managers only; audited. */
export class SetAutomationRuleHandler {
  constructor(private readonly settings: IAutomationSettings, private readonly audit: { record(e: unknown): Promise<void> }, private readonly clock: IClock) {}

  async handle(ctx: AuthenticatedContext, projectId: string, ruleKey: string, enabled: boolean): Promise<Result<void, DomainError>> {
    const allowed = PlanAccess.requireManage(ctx);
    if (!allowed.ok) return allowed;
    if (!(AUTOMATION_RULE_KEYS as string[]).includes(ruleKey)) return err(DomainError.notFound("Automation rule", ruleKey));
    const saved = await this.settings.set(projectId, ruleKey as AutomationRuleKey, enabled, { userId: ctx.tenant.userId, now: this.clock.now() }, ctx.tenant.tenantId);
    if (!saved.ok) return saved;
    await this.audit.record({
      tenantId: ctx.tenant.tenantId, actorId: ctx.tenant.userId, eventType: "workplan.automation_set", entityType: "project", entityId: projectId, projectId,
      newValue: JSON.stringify({ ruleKey, enabled }),
    });
    return ok(undefined);
  }
}

/**
 * Runs the automation rules across the organisation's projects, once per day from the hourly reminder run. Each notice goes to
 * one person, once per item per rule per day (the ledger remembers). Returns how many were sent.
 */
export class RunAutomationsHandler {
  constructor(
    private readonly projects: IProjectRepository, private readonly items: IPlannedActivityRepository, private readonly facts: IDeliveryFactsReader,
    private readonly settings: IAutomationSettings, private readonly audience: IReminderAudience, private readonly ledger: IReminderLedger,
    private readonly notifier: IPersonNotifier,
  ) {}

  async runFor(ctx: AuthenticatedContext, today: PlainDate): Promise<Result<number, DomainError>> {
    const tenantId = ctx.tenant.tenantId;
    const managers = await this.audience.projectManagers(tenantId);
    if (!managers.ok) return managers;
    const projects = await this.projects.listByTenant(tenantId);
    if (!projects.ok) return projects;
    let sent = 0;
    for (const project of projects.value) {
      const stored = await this.settings.stored(project.id, tenantId);
      if (!stored.ok) return stored;
      const enabled = enabledFrom(stored.value);
      if (enabled.size === 0) continue;
      const items = await this.items.findByProject(project.id, tenantId);
      if (!items.ok) return items;
      const facts = await this.facts.factsByPlannedActivity(project.id, tenantId);
      if (!facts.ok) return facts;
      const view: AutomationItem[] = items.value.map((i) => {
        const s = i.snapshot();
        const f = facts.value.get(i.id) ?? NO_DELIVERY;
        return {
          id: i.id, title: i.title, ownerUserId: s.ownerUserId, status: s.status, plannedStart: s.plannedStart, plannedEnd: s.plannedEnd,
          stillNeeded: f.liveRecords === 0 ? [] : evidenceCoverage(s.requiredFiles, f.evidenceTypes ?? []).stillNeeded,
        };
      });
      const manager = managers.value.get(project.id);
      for (const notice of automationNotices(view, today, enabled)) {
        const recipient = notice.recipient === "LEAD" ? view.find((v) => v.id === notice.itemId)?.ownerUserId : manager;
        if (!recipient) continue;
        const subjectKey = noticeSubjectKey(notice);
        const told = await this.ledger.wasSent(tenantId, recipient, subjectKey, "AUTOMATION", today);
        if (!told.ok) return told;
        if (told.value) continue;
        const recorded = await this.ledger.record({ tenantId, recipientId: recipient, subjectKey, ruleKey: "AUTOMATION", sentOn: today });
        if (!recorded.ok) return recorded;
        await this.notifier.send({
          tenantId, recipientId: recipient, type: "DEADLINE_REMINDER", title: notice.title, message: notice.message,
          relatedEntityType: "planned_activity", relatedEntityId: notice.itemId, urgent: notice.recipient === "MANAGER",
        });
        sent += 1;
      }
    }
    return ok(sent);
  }
}

/** The rules a project has, with their words and whether each is on. */
export class ListAutomationRulesHandler {
  constructor(private readonly settings: IAutomationSettings) {}

  async handle(ctx: AuthenticatedContext, projectId: string): Promise<Result<Array<{ ruleKey: AutomationRuleKey; label: string; enabled: boolean }>, DomainError>> {
    const stored = await this.settings.stored(projectId, ctx.tenant.tenantId);
    if (!stored.ok) return stored;
    const enabled = enabledFrom(stored.value);
    return ok(AUTOMATION_RULE_KEYS.map((k) => ({ ruleKey: k, label: AUTOMATION_RULES[k].label, enabled: enabled.has(k) })));
  }
}
