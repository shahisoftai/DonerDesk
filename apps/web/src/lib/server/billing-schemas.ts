import { z } from "zod";
import { PlanLimitsJsonSchema, BillingSummaryUsageSchema } from "@donordesk/contracts";

export const BillingSummarySchema = z.object({
  plan: z.enum(["STARTER", "TEAM", "GROWTH", "ENTERPRISE"]),
  source: z.enum(["DEFAULT", "TRIAL", "CREEM_SUBSCRIPTION", "ENTERPRISE_CONTRACT", "GRANDFATHERED", "MANUAL"]),
  catalogVersion: z.number().int(),
  trialEndsAt: z.string().datetime().optional(),
  isTrial: z.boolean().optional(),
  subscription: z
    .object({
      status: z.string(),
      interval: z.string().optional(),
      currentPeriodEnd: z.string().datetime().optional(),
      cancelAtPeriodEnd: z.boolean().default(false),
    })
    .optional(),
  // The page only reads usage and the top-up flag: a missing bucket must never blank it (D5-5).
  limits: PlanLimitsJsonSchema.partial(),
  overLimit: z.array(z.enum(["PROJECTS", "SEATS", "VIEWERS", "STORAGE", "AI_CREDITS"])),
  usage: BillingSummaryUsageSchema,
});
export type BillingSummary = z.output<typeof BillingSummarySchema>;

export const CheckoutResponseSchema = z.object({ url: z.string().url() });
export const PortalResponseSchema = z.object({ url: z.string().url() });
