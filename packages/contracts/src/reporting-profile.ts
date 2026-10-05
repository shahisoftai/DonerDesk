import { z } from "zod";

export const ProfileToneSchema = z.enum(["FORMAL", "CONCISE", "NARRATIVE", "TECHNICAL"]);

export const WordCountOverrideSchema = z
  .object({
    min: z.number().int().nonnegative().optional(),
    max: z.number().int().positive().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.min !== undefined && v.max !== undefined && v.min > v.max) {
      ctx.addIssue({ code: "custom", path: ["max"], message: "max must be at least min" });
    }
  });

export const FinanceDataModeSchema = z.enum(["DISABLED", "TYPED", "IMPORT"]);

export const UpsertReportingProfileSchema = z.object({
  defaultTemplateId: z.string().min(1).optional(),
  language: z.string().min(2).max(10).default("en"),
  tone: ProfileToneSchema.default("FORMAL"),
  writingStyle: z.string().max(1000).optional(),
  audienceNotes: z.string().max(1000).optional(),
  formattingRules: z.array(z.string().max(200)).max(50).default([]),
  specialRequirements: z.array(z.string().max(200)).max(50).default([]),
  sectionOverrides: z.record(WordCountOverrideSchema).default({}),
  deadlineOffsetDays: z.number().int().min(0).max(365).optional(),
  autoPeriodCreation: z.boolean().optional(),
  /** How reports get financial figures; omitted leaves it unchanged. */
  financeDataMode: FinanceDataModeSchema.optional(),
  expectedVersion: z.number().int().positive().optional(),
});
export type UpsertReportingProfileInput = z.infer<typeof UpsertReportingProfileSchema>;

export const AcknowledgeProjectSetupSchema = z.object({
  acknowledged: z.literal(true, { errorMap: () => ({ message: 'Send {"acknowledged": true} to confirm the setup.' }) }),
});
export type AcknowledgeProjectSetupInput = z.infer<typeof AcknowledgeProjectSetupSchema>;
