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
  viewerSeats: z.number().int().nullable(),
  aiCreditTopUp: z.boolean(),
  byoLlmEnabled: z.boolean(),
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
  projects: z.object({
    active: z.number().int(),
    archived: z.number().int(),
    limit: z.number().int().nullable(),
  }),
  seats: z.object({
    full: z.object({ used: z.number().int(), limit: z.number().int().nullable() }),
    viewers: z.object({ used: z.number().int(), limit: z.number().int().nullable() }),
  }),
  managedStorageBytes: z.object({
    used: z.string().regex(/^\d+$/),
    limit: z.string().regex(/^\d+$/).nullable(),
  }),
  aiDraftCredits: z.object({
    planAllowance: z.number().int().nullable(),
    packs: z.object({
      active: z.number().int(),
      credits: z.number().int(),
      used: z.number().int(),
    }),
    standingBalance: z.object({
      active: z.number().int(),
      credits: z.number().int(),
      used: z.number().int(),
      maxActive: z.number().int(),
    }),
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
  overLimit: z.array(z.enum(["PROJECTS", "SEATS", "VIEWERS", "STORAGE", "AI_CREDITS"])),
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

export const CreditPackSkuSchema = z.enum(["TOPUP_50", "TOPUP_100", "STANDING_BALANCE_100"]);
export type CreditPackSku = z.infer<typeof CreditPackSkuSchema>;

export const CreateTopupCheckoutSchema = z.object({
  sku: CreditPackSkuSchema,
});
export type CreateTopupCheckoutInput = z.infer<typeof CreateTopupCheckoutSchema>;

/** Validated URL for the certificate document link (link-first, no upload). */
const certificateUrl = z
  .string()
  .min(1)
  .max(2000)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  }, "documentUrl must be a valid http(s) URL");

export const SubmitNonprofitVerificationSchema = z.object({
  registrationNumber: z.string().min(1).max(200),
  documentUrl: certificateUrl,
});
export type SubmitNonprofitVerificationInput = z.infer<typeof SubmitNonprofitVerificationSchema>;

export const SubmitNonprofitVerificationResponseSchema = z.object({ id: z.string() });
export type SubmitNonprofitVerificationResponse = z.infer<typeof SubmitNonprofitVerificationResponseSchema>;

export const PortalResponseSchema = z.object({
  url: z.string().url(),
});
export type PortalResponse = z.infer<typeof PortalResponseSchema>;

export const CreatePortalSchema = z.object({}).optional();
export type CreatePortalInput = z.infer<typeof CreatePortalSchema>;
