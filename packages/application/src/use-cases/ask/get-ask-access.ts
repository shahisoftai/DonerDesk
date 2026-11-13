import { DomainError, askAccess, type AskAccess, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IOrganizationRepository } from "../../ports/identity.js";
import type { EntitlementService } from "../../services/entitlement-service.js";

/**
 * Whether the person's organisation may use Ask (the one `askAccess` rule: plan, then the administrator's opt-in, then AI). Read by
 * Settings and the floating assistant so they show what the API will enforce. A failed plan read answers NOT_IN_PLAN: closed, not guessed.
 */
export class GetAskAccessHandler {
  constructor(private readonly orgs: IOrganizationRepository, private readonly entitlements: Pick<EntitlementService, "resolve">) {}

  async handle(ctx: AuthenticatedContext, external = false): Promise<Result<AskAccess, DomainError>> {
    const [org, entitlement] = await Promise.all([this.orgs.findByTenant(ctx.tenant.tenantId), this.entitlements.resolve({ tenantId: String(ctx.tenant.tenantId) })]);
    if (!org.ok) return org;
    if (!entitlement.ok) return { ok: true, value: "NOT_IN_PLAN" };
    return {
      ok: true,
      value: askAccess({
        planCode: entitlement.value.planCode, limits: entitlement.value.limits,
        askEnabled: org.value?.askEnabled === true, aiEnabled: org.value?.aiEnabled === true, external,
      }),
    };
  }
}
