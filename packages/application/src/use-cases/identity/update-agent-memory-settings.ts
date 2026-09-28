import type { Result } from "@donordesk/domain";
import { DomainError, Permissions, type Role } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IOrganizationRepository } from "../../ports/identity.js";
import type { IAuditLogger } from "../../ports/core.js";

export interface UpdateAgentMemorySettingsInput {
  enabled: boolean;
}

/**
 * Tenant self-service toggle for Agent Memory (§4.1) — a single, narrow
 * boolean, kept separate from `UpdateOrganizationHandler`'s broader
 * profile-editing surface for the same reason `update-organization-
 * reporting-defaults.ts` is separate: a single, reviewable unit. Unlike that
 * handler this one gates on `report.manage-agent-memory`, since the toggle
 * controls whether reviewer edits are read for learning purposes at all.
 */
export class UpdateAgentMemorySettingsHandler {
  constructor(
    private readonly orgs: IOrganizationRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, input: UpdateAgentMemorySettingsInput): Promise<Result<void, DomainError>> {
    if (!Permissions.can(ctx.tenant.role as Role, "report.manage-agent-memory")) {
      return {
        ok: false,
        error: DomainError.forbidden("Only report managers can change the AI Writing Style setting", {
          capability: "report.manage-agent-memory",
        }),
      };
    }

    const result = await this.orgs.findByTenant(ctx.tenant.tenantId);
    if (!result.ok) return result;
    if (!result.value) return { ok: false, error: DomainError.notFound("Organization", ctx.tenant.tenantId.toString()) };
    const org = result.value;

    org.updateAgentMemorySettings({ enabled: input.enabled });
    const saved = await this.orgs.update(org);
    if (!saved.ok) return saved;

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "organization.agent_memory_toggled",
      entityType: "organization",
      entityId: org.id,
      newValue: JSON.stringify({ enabled: input.enabled }),
    });

    return { ok: true, value: undefined };
  }
}
