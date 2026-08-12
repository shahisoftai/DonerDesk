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

export const TemplateSectionSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  description: z.string().default(""),
  inputType: SectionInputTypeSchema,
  required: z.boolean().default(true),
  evidenceNeeded: z.string().default(""),
  relatedLogframeElement: z.string().optional(),
});
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
