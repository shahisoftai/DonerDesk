"use server";

import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { BillingSummarySchema, CheckoutResponseSchema, PortalResponseSchema } from "@/lib/server/billing-schemas";

export async function getBillingSummaryAction() {
  const ctx = await requireSession();
  return gatewayRequest("/v1/billing/summary", BillingSummarySchema, ctx.token);
}

export async function createCheckoutAction(input: { plan: "TEAM" | "GROWTH"; interval?: "MONTH" | "YEAR" }) {
  const ctx = await requireSession();
  return gatewayRequest("/v1/billing/checkout", CheckoutResponseSchema, ctx.token, {
    method: "POST",
    body: { plan: input.plan, interval: input.interval ?? "MONTH" },
  });
}

export async function openPortalAction() {
  const ctx = await requireSession();
  return gatewayRequest("/v1/billing/portal", PortalResponseSchema, ctx.token, { method: "POST", body: {} });
}
