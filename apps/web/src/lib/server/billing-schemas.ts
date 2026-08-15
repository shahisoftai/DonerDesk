import { z } from "zod";

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
  limits: z.object({
    maxActiveProjects: z.number().int().nullable(),
    maxSeats: z.number().int().nullable(),
    maxManagedStorageBytes: z.string().nullable(),
    monthlyAiDraftCredits: z.number().int().nullable(),
  }),
  overLimit: z.array(z.enum(["PROJECTS", "SEATS", "STORAGE", "AI_CREDITS"])),
  usage: z.object({
    projects: z.object({ used: z.number().int(), limit: z.number().int().nullable() }),
    seats: z.object({ used: z.number().int(), limit: z.number().int().nullable() }),
    managedStorageBytes: z.object({ used: z.string(), limit: z.string().nullable() }),
    aiDraftCredits: z.object({
      used: z.number().int(),
      limit: z.number().int().nullable(),
      resetsAt: z.string().datetime().optional(),
    }),
  }),
});
export type BillingSummary = z.output<typeof BillingSummarySchema>;

export const CheckoutResponseSchema = z.object({ url: z.string().url() });
export const PortalResponseSchema = z.object({ url: z.string().url() });
