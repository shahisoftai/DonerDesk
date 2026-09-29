"use server";

import { z } from "zod";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { BillingSummarySchema, CheckoutResponseSchema, PortalResponseSchema } from "@/lib/server/billing-schemas";

const NonprofitVerificationResponseSchema = z.object({ id: z.string() });

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

export async function buyTopupAction(input: { sku: "TOPUP_50" | "TOPUP_100" | "STANDING_BALANCE_100" }) {
  const ctx = await requireSession();
  return gatewayRequest("/v1/billing/topup", CheckoutResponseSchema, ctx.token, {
    method: "POST",
    body: { sku: input.sku },
  });
}

export async function submitNonprofitVerificationAction(input: { registrationNumber: string; documentUrl: string }) {
  const ctx = await requireSession();
  return gatewayRequest("/v1/billing/nonprofit-verification", NonprofitVerificationResponseSchema, ctx.token, {
    method: "POST",
    body: input,
  });
}

export async function openPortalAction() {
  const ctx = await requireSession();
  return gatewayRequest("/v1/billing/portal", PortalResponseSchema, ctx.token, { method: "POST", body: {} });
}
