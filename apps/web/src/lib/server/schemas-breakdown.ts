import { z } from "zod";

/** Targets by group beside the verified figure so far, per indicator that has them. */
export const BreakdownProgressSchema = z.object({
  items: z.array(z.object({
    indicatorId: z.string(),
    code: z.string(),
    name: z.string(),
    unit: z.string().nullable(),
    type: z.string(),
    rows: z.array(z.object({
      dimension: z.string(),
      category: z.string(),
      target: z.number().nullable(),
      actual: z.number().nullable(),
      percentOfTarget: z.number().nullable(),
      periods: z.number(),
    })),
  })),
});
export type BreakdownProgress = z.infer<typeof BreakdownProgressSchema>;
