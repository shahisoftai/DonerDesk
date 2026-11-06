import { enabledFrom } from "@donordesk/application";
import type { IAutomationRuleSettings, IAutomationSettings } from "@donordesk/application";
import { AUTOMATION_REGISTRY, DomainError, ok } from "@donordesk/domain";
import type { AutomationRuleKey, Result, TenantId } from "@donordesk/domain";
import type { PrismaClient } from "@prisma/client";

/** Automation rules a project has switched off (phase 28.1-K). A rule with no row is on. */
export class PrismaAutomationSettings implements IAutomationSettings, IAutomationRuleSettings {
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

  /** The numbers each rule was given; a damaged value reads as none, so the rule runs on its defaults. */
  async storedSettings(projectId: string, tenantId: TenantId): Promise<Result<Record<string, Record<string, number>>, DomainError>> {
    const rows = await this.prisma.projectAutomation.findMany({ where: { tenantId: tenantId.toString(), projectId, settingsJson: { not: null } } });
    const out: Record<string, Record<string, number>> = {};
    for (const r of rows) {
      try {
        const parsed = JSON.parse(r.settingsJson ?? "{}");
        if (parsed && typeof parsed === "object") out[r.ruleKey] = parsed as Record<string, number>;
      } catch { /* damaged value: the rule uses its defaults */ }
    }
    return ok(out);
  }

  /** Saves the numbers without changing whether the rule is on: a new row starts with the rule's default. */
  async setSettings(projectId: string, ruleKey: AutomationRuleKey, values: Record<string, number>, by: { userId: string; now: Date }, tenantId: TenantId): Promise<Result<void, DomainError>> {
    const tenant = tenantId.toString();
    await this.prisma.projectAutomation.upsert({
      where: { projectId_ruleKey: { projectId, ruleKey } },
      create: { id: `${projectId}:${ruleKey}`, tenantId: tenant, projectId, ruleKey, enabled: AUTOMATION_REGISTRY[ruleKey].defaultOn, settingsJson: JSON.stringify(values), updatedById: by.userId, updatedAt: by.now },
      update: { settingsJson: JSON.stringify(values), updatedById: by.userId, updatedAt: by.now },
    });
    return ok(undefined);
  }
}
