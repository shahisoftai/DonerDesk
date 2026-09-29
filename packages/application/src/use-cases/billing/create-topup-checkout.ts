import type { Result } from "@donordesk/domain";
import { DomainError, MAX_ACTIVE_GROWTH_STANDING_BALANCE_PACKS, Permissions, type Role } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IOrganizationRepository } from "../../ports/identity.js";
import type { BillingProvider, CreditPackSku, IPurchasedCreditPackRepository } from "../../ports/billing.js";
import type { IAuditLogger } from "../../ports/core.js";
import type { EntitlementService } from "../../services/entitlement-service.js";

/** SKUs that mint a Growth-only standing-balance pack rather than a regular top-up. */
const STANDING_BALANCE_SKUS = new Set<CreditPackSku>(["STANDING_BALANCE_100"]);

const SUCCESS_PATH = "/thanks";

export interface CreateTopupCheckoutInput {
  sku: CreditPackSku;
}

/**
 * Server-side one-off checkout intent for an AI-credit top-up pack. Mirrors
 * CreateCheckoutHandler's shape, but gates on `aiCreditTopUp` (TEAM/GROWTH/
 * ENTERPRISE) rather than on subscription state — a top-up purchase is
 * independent of, and can be bought regardless of, subscription lifecycle.
 */
export class CreateTopupCheckoutHandler {
  constructor(
    private readonly billing: BillingProvider,
    private readonly orgs: IOrganizationRepository,
    private readonly entitlements: EntitlementService,
    private readonly audit: IAuditLogger,
    private readonly packs?: IPurchasedCreditPackRepository,
  ) {}

  async handle(ctx: AuthenticatedContext, input: CreateTopupCheckoutInput): Promise<Result<{ checkoutId: string; url: string }, DomainError>> {
    Permissions.require(ctx.tenant.role as Role, "billing.manage");
    const tenantId = ctx.tenant.tenantId.toString();

    const entitlementResult = await this.entitlements.resolve({ tenantId });
    if (!entitlementResult.ok) return entitlementResult;
    if (!entitlementResult.value.limits.aiCreditTopUp) {
      return { ok: false, error: DomainError.billingStateInvalid("This plan does not support AI credit top-up packs.") };
    }

    if (STANDING_BALANCE_SKUS.has(input.sku)) {
      // Growth-only prepaid standing balance (§4 WS-D item 5) — distinct gate
      // from the generic aiCreditTopUp check above: a Team/Enterprise tenant
      // has top-up but not this SKU.
      if (entitlementResult.value.planCode !== "GROWTH") {
        return { ok: false, error: DomainError.billingStateInvalid("The prepaid standing balance is only available on the Growth plan.") };
      }
      if (this.packs) {
        const activeResult = await this.packs.listActiveByTenant(tenantId);
        if (!activeResult.ok) return activeResult;
        const activeStandingBalance = activeResult.value.filter((p) => p.source === "GROWTH_STANDING_BALANCE").length;
        if (activeStandingBalance >= MAX_ACTIVE_GROWTH_STANDING_BALANCE_PACKS) {
          return {
            ok: false,
            error: DomainError.billingStateInvalid(`You may hold at most ${MAX_ACTIVE_GROWTH_STANDING_BALANCE_PACKS} active standing-balance packs.`),
          };
        }
      }
    }

    const orgResult = await this.orgs.findByTenant(ctx.tenant.tenantId);
    if (!orgResult.ok) return orgResult;
    if (!orgResult.value) return { ok: false, error: DomainError.notFound("Organization", tenantId) };

    const baseUrl = process.env.BILLING_SUCCESS_BASE_URL ?? "";
    const successUrl = `${baseUrl}${SUCCESS_PATH}`;
    const created = await this.billing.createOneOffCheckout({
      tenantId,
      requestId: ctx.requestId,
      sku: input.sku,
      customerEmail: orgResult.value.contactEmail,
      successUrl,
    });
    if (!created.ok) return created;

    await this.audit.record({
      tenantId: ctx.tenant.tenantId,
      actorId: ctx.tenant.userId,
      eventType: "billing.topup_checkout.created",
      entityType: "billing",
      entityId: created.value.checkoutId,
      newValue: JSON.stringify({ sku: input.sku }),
    });

    return { ok: true, value: created.value };
  }
}
