import { z } from "zod";

export const ReportTypeSchema = z.enum([
  "MONTHLY",
  "QUARTERLY",
  "ANNUAL",
  "FINAL",
  "ACTIVITY",
  "SITUATION",
  "CUSTOM",
]);

export const SectionInputTypeSchema = z.enum(["NARRATIVE", "TABLE", "ANNEX", "INDICATOR_TABLE", "COMPLIANCE"]);

export const SectionReviewStatusSchema = z.enum(["DRAFT", "REVIEWED"]);

const wordLimits = (v: { minWords?: number; maxWords?: number }, ctx: z.RefinementCtx): void => {
  if (v.minWords !== undefined && v.minWords < 0) {
    ctx.addIssue({ code: "custom", path: ["minWords"], message: "minWords must be nonnegative" });
  }
  if (v.maxWords !== undefined && v.maxWords <= 0) {
    ctx.addIssue({ code: "custom", path: ["maxWords"], message: "maxWords must be positive" });
  }
  if (v.minWords !== undefined && v.maxWords !== undefined && v.minWords > v.maxWords) {
    ctx.addIssue({ code: "custom", path: ["maxWords"], message: "maxWords must be at least minWords" });
  }
};

export const TemplateSectionSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().min(1),
    description: z.string().default(""),
    inputType: SectionInputTypeSchema,
    required: z.boolean().default(true),
    evidenceNeeded: z.string().default(""),
    relatedLogframeElement: z.string().optional(),
    reviewStatus: SectionReviewStatusSchema.default("DRAFT"),
    minWords: z.number().int().optional(),
    maxWords: z.number().int().optional(),
  })
  .superRefine(wordLimits);
export type TemplateSectionInput = z.infer<typeof TemplateSectionSchema>;

export const CreateDonorTemplateSchema = z.object({
  projectId: z.string().min(1),
  templateName: z.string().min(1).max(200),
  donorName: z.string().min(1).max(200),
  reportType: ReportTypeSchema,
  language: z.string().min(2).max(10).default("en"),
  requiredAnnexes: z.array(z.string()).default([]),
  notes: z.string().max(2000).optional(),
  extractedRawText: z.string().optional(),
  originalFileUrl: z.string().optional(),
  sections: z.array(TemplateSectionSchema).default([]),
});
export type CreateDonorTemplateInput = z.infer<typeof CreateDonorTemplateSchema>;

export const UpdateTemplateSectionsSchema = z.object({
  sections: z.array(TemplateSectionSchema),
});
