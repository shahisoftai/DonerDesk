import type { Result } from "@donordesk/domain";
import { DomainError, BillingSubscription } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IOrganizationRepository } from "../../ports/identity.js";
import type { BillingProvider } from "../../ports/billing.js";
import type { IBillingSubscriptionRepository } from "../../ports/billing.js";
import type { IIdGenerator, IAuditLogger } from "../../ports/core.js";
import type { CreateCheckoutInput } from "@donordesk/contracts";

const SUCCESS_PATH = "/thanks";

/**
 * Server-side checkout intent. The browser never supplies a product id, a
 * customer id, or an arbitrary success URL: the handler resolves the tenant's
 * organization, maps (plan, interval) to the allowlisted provider product, and
 * returns only the provider checkout URL.
 */
export class CreateCheckoutHandler {
  constructor(
    private readonly billing: BillingProvider,
    private readonly orgs: IOrganizationRepository,
    private readonly subscriptions: IBillingSubscriptionRepository,
    private readonly ids: IIdGenerator,
    private readonly audit: IAuditLogger,
  ) {}

  async handle(ctx: AuthenticatedContext, input: CreateCheckoutInput): Promise<Result<{ checkoutId: string; url: string }, DomainError>> {
    const tenantId = ctx.tenant.tenantId.toString();

    // Reject a duplicate/incompatible checkout while a subscription already
    // grants access to the same plan.
    const existing = await this.subscriptions.findAccessGrantingByTenant(tenantId);
    if (!existing.ok) return existing;
    if (existing.value && existing.value.planCode === input.plan && existing.value.status !== "CANCELLED" && existing.value.status !== "EXPIRED") {
      return { ok: false, error: DomainError.billingStateInvalid("An active subscription already exists for this plan.") };
    }

    const orgResult = await this.orgs.findByTenant(ctx.tenant.tenantId);
    if (!orgResult.ok) return orgResult;
    if (!orgResult.value) return { ok: false, error: DomainError.notFound("Organization", tenantId) };

    const baseUrl = process.env.BILLING_SUCCESS_BASE_URL ?? "";
    const successUrl = `${baseUrl}${SUCCESS_PATH}`;
    const created = await this.billing.createCheckout({
      tenantId,
      requestId: ctx.requestId,
      plan: input.plan,
      interval: input.interval,
      customerEmail: orgResult.value.contactEmail,
      successUrl,
    });
    if (!created.ok) return created;

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "billing.checkout.created",
      entityType: "billing",
      entityId: created.value.checkoutId,
      newValue: JSON.stringify({ plan: input.plan, interval: input.interval }),
    });

    return { ok: true, value: created.value };
  }
}
