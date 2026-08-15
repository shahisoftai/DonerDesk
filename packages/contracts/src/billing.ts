import { z } from "zod";

export const PlanCodeSchema = z.enum(["STARTER", "TEAM", "GROWTH", "ENTERPRISE"]);
export type PlanCode = z.infer<typeof PlanCodeSchema>;

export const PlanCodeForCheckoutSchema = z.enum(["TEAM", "GROWTH"]);
export type PlanCodeForCheckout = z.infer<typeof PlanCodeForCheckoutSchema>;

export const BillingIntervalSchema = z.enum(["MONTH", "YEAR"]);
export type BillingInterval = z.infer<typeof BillingIntervalSchema>;

export const BillingProviderCodeSchema = z.enum(["CREEM"]);
export const BillingSubscriptionStatusSchema = z.enum([
  "ACTIVE",
  "TRIALING",
  "PAST_DUE",
  "UNPAID",
  "CANCELLED",
  "EXPIRED",
  "PAUSED",
]);
export const EntitlementSourceSchema = z.enum([
  "DEFAULT",
  "TRIAL",
  "CREEM_SUBSCRIPTION",
  "ENTERPRISE_CONTRACT",
  "GRANDFATHERED",
  "MANUAL",
]);

export const PlanLimitsJsonSchema = z.object({
  maxActiveProjects: z.number().int().nullable(),
  maxSeats: z.number().int().nullable(),
  maxManagedStorageBytes: z.string().regex(/^\d+$/).nullable(),
  monthlyAiDraftCredits: z.number().int().nullable(),
});
export type PlanLimitsJson = z.infer<typeof PlanLimitsJsonSchema>;

export const BillingSubscriptionViewSchema = z.object({
  status: BillingSubscriptionStatusSchema,
  interval: BillingIntervalSchema,
  currentPeriodEnd: z.string().datetime().optional(),
  cancelAtPeriodEnd: z.boolean().default(false),
});
export type BillingSubscriptionView = z.infer<typeof BillingSubscriptionViewSchema>;

export const BillingSummaryUsageSchema = z.object({
  projects: z.object({ used: z.number().int(), limit: z.number().int().nullable() }),
  seats: z.object({ used: z.number().int(), limit: z.number().int().nullable() }),
  managedStorageBytes: z.object({
    used: z.string().regex(/^\d+$/),
    limit: z.string().regex(/^\d+$/).nullable(),
  }),
  aiDraftCredits: z.object({
    used: z.number().int(),
    limit: z.number().int().nullable(),
    resetsAt: z.string().datetime().optional(),
  }),
});
export type BillingSummaryUsage = z.infer<typeof BillingSummaryUsageSchema>;

export const BillingSummarySchema = z.object({
  plan: PlanCodeSchema,
  source: EntitlementSourceSchema,
  catalogVersion: z.number().int(),
  trialEndsAt: z.string().datetime().optional(),
  isTrial: z.boolean().default(false),
  subscription: BillingSubscriptionViewSchema.optional(),
  limits: PlanLimitsJsonSchema,
  overLimit: z.array(z.enum(["PROJECTS", "SEATS", "STORAGE", "AI_CREDITS"])),
  usage: BillingSummaryUsageSchema,
});
export type BillingSummary = z.infer<typeof BillingSummarySchema>;

export const CreateCheckoutSchema = z.object({
  plan: PlanCodeForCheckoutSchema,
  interval: BillingIntervalSchema.default("MONTH"),
});
export type CreateCheckoutInput = z.infer<typeof CreateCheckoutSchema>;

export const CheckoutResponseSchema = z.object({
  checkoutId: z.string(),
  url: z.string().url(),
});
export type CheckoutResponse = z.infer<typeof CheckoutResponseSchema>;

export const PortalResponseSchema = z.object({
  url: z.string().url(),
});
export type PortalResponse = z.infer<typeof PortalResponseSchema>;

export const CreatePortalSchema = z.object({}).optional();
export type CreatePortalInput = z.infer<typeof CreatePortalSchema>;
