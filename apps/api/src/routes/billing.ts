import type { FastifyInstance } from "fastify";
import { CreateCheckoutSchema, BillingSummarySchema, CheckoutResponseSchema, PortalResponseSchema, CreateTopupCheckoutSchema, SubmitNonprofitVerificationSchema, SubmitNonprofitVerificationResponseSchema } from "@donordesk/contracts";

/**
 * Billing routes (authenticated). Summary is a read model; checkout/portal
 * mutations require `billing.manage` (enforced by authorizationMiddleware).
 */
export async function registerBillingRoutes(app: FastifyInstance) {
  app.get("/v1/billing/summary", async (req) => {
    const ctx = { tenant: req.tenant, requestId: req.id };
    const result = await req.container.handlers.getBillingSummary.handle(ctx);
    if (!result.ok) throw result.error;
    return BillingSummarySchema.parse(result.value);
  });

  app.post("/v1/billing/checkout", async (req) => {
    const body = CreateCheckoutSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const result = await req.container.handlers.createCheckout.handle(ctx, body);
    if (!result.ok) throw result.error;
    return CheckoutResponseSchema.parse(result.value);
  });

  app.post("/v1/billing/topup", async (req) => {
    const body = CreateTopupCheckoutSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const result = await req.container.handlers.createTopupCheckout.handle(ctx, body);
    if (!result.ok) throw result.error;
    return CheckoutResponseSchema.parse(result.value);
  });

  app.post("/v1/billing/nonprofit-verification", async (req) => {
    const body = SubmitNonprofitVerificationSchema.parse(req.body);
    const ctx = { tenant: req.tenant, requestId: req.id };
    const result = await req.container.handlers.submitNonprofitVerification.handle(ctx, body);
    if (!result.ok) throw result.error;
    return SubmitNonprofitVerificationResponseSchema.parse(result.value);
  });

  app.post("/v1/billing/portal", async (req) => {
    const ctx = { tenant: req.tenant, requestId: req.id };
    const result = await req.container.handlers.createCustomerPortal.handle(ctx);
    if (!result.ok) throw result.error;
    return PortalResponseSchema.parse(result.value);
  });
}
