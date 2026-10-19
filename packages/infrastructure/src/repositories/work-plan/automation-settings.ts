import { enabledFrom } from "@donordesk/application";
import type { IAutomationSettings } from "@donordesk/application";
import { DomainError, ok } from "@donordesk/domain";
import type { AutomationRuleKey, Result, TenantId } from "@donordesk/domain";
import type { PrismaClient } from "@prisma/client";

/** Automation rules a project has switched off (phase 28.1-K). A rule with no row is on. */
export class PrismaAutomationSettings implements IAutomationSettings {
  constructor(private readonly prisma: PrismaClient) {}

  async stored(projectId: string, tenantId: TenantId): Promise<Result<Record<string, boolean>, DomainError>> {
    const rows = await this.prisma.projectAutomation.findMany({ where: { tenantId: tenantId.toString(), projectId } });
    return ok(Object.fromEntries(rows.map((r) => [r.ruleKey, r.enabled])));
  }

  async enabledRules(projectId: string, tenantId: TenantId): Promise<Result<Set<AutomationRuleKey>, DomainError>> {
    const stored = await this.stored(projectId, tenantId);
    if (!stored.ok) return stored;
    return ok(enabledFrom(stored.value));
  }

  async set(projectId: string, ruleKey: AutomationRuleKey, enabled: boolean, by: { userId: string; now: Date }, tenantId: TenantId): Promise<Result<void, DomainError>> {
    const tenant = tenantId.toString();
    await this.prisma.projectAutomation.upsert({
      where: { projectId_ruleKey: { projectId, ruleKey } },
      create: { id: `${projectId}:${ruleKey}`, tenantId: tenant, projectId, ruleKey, enabled, updatedById: by.userId, updatedAt: by.now },
      update: { enabled, updatedById: by.userId, updatedAt: by.now },
    });
    return ok(undefined);
  }
}
