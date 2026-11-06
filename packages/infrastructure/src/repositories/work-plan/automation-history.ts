import { AUTOMATION_RULE_KEYS, DomainError, ok } from "@donordesk/domain";
import type { Result, TenantId } from "@donordesk/domain";
import type { AutomationHistoryRow, IAutomationHistory } from "@donordesk/application";
import type { PrismaClient } from "@prisma/client";

/**
 * What the automations sent for one project. The ledger keys a notice as `automation:<rule>:<activity id>`, so the project's rows are
 * the ones whose key is a rule and one of the project's activities: an exact match, not a guess from text.
 */
export class PrismaAutomationHistory implements IAutomationHistory {
  constructor(private readonly prisma: PrismaClient) {}

  async recent(projectId: string, tenantId: TenantId, limit: number): Promise<Result<AutomationHistoryRow[], DomainError>> {
    const tenant = tenantId.toString();
    const items = await this.prisma.plannedActivity.findMany({ where: { tenantId: tenant, projectId }, select: { id: true } });
    if (items.length === 0) return ok([]);
    const keys = items.flatMap((i) => AUTOMATION_RULE_KEYS.map((rule) => `automation:${rule}:${i.id}`));
    const rows = await this.prisma.reminderLedgerEntry.findMany({
      where: { tenantId: tenant, ruleKey: "AUTOMATION", subjectKey: { in: keys } },
      orderBy: [{ sentOn: "desc" }, { createdAt: "desc" }],
      take: limit,
    });
    return ok(rows.map((r) => {
      const [, rule = "", ...rest] = r.subjectKey.split(":");
      return { sentOn: r.sentOn.toISOString().slice(0, 10), ruleKey: rule, itemId: rest.join(":"), recipientId: r.recipientId };
    }));
  }
}
