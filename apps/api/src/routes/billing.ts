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

  /** The tenant's recent AI section runs (written / recovered / basic version, with the reason). Administrators only. */
  app.get("/v1/ai/section-runs", async (req) => {
    const ctx = { tenant: req.tenant, requestId: req.id };
    const result = await req.container.handlers.listAiSectionRuns.handle(ctx);
    if (!result.ok) throw result.error;
    return {
      counts: result.value.counts,
      alert: result.value.alert,
      runs: result.value.runs.map((r) => ({ ...r, at: r.at.toISOString() })),
    };
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
