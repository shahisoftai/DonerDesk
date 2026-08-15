import type { Result } from "@donordesk/domain";
import { DomainError } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { BillingProvider } from "../../ports/billing.js";
import type { IBillingSubscriptionRepository } from "../../ports/billing.js";
import type { IAuditLogger } from "../../ports/core.js";

/**
 * Requests a short-lived provider Customer Portal URL for the authenticated
 * tenant. The customer id is resolved server-side — never from the client —
 * and the portal link is never logged.
 */
export class CreateCustomerPortalHandler {
  constructor(
    private readonly billing: BillingProvider,
    private readonly subscriptions: IBillingSubscriptionRepository,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext): Promise<Result<{ url: string }, DomainError>> {
    const tenantId = ctx.tenant.tenantId.toString();
    const existing = await this.subscriptions.findAccessGrantingByTenant(tenantId);
    if (!existing.ok) return existing;
    if (!existing.value) {
      return { ok: false, error: DomainError.billingStateInvalid("No subscription exists for this organization.") };
    }

    const portal = await this.billing.createCustomerPortal({
      providerCustomerId: existing.value.providerCustomerId,
    });
    if (!portal.ok) return portal;

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "billing.portal.opened",
      entityType: "billing",
      entityId: existing.value.id,
      newValue: "customer-portal",
    });

    return { ok: true, value: portal.value };
  }
}
