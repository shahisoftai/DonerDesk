import { z } from "zod";
import { ReportingFrequencySchema } from "./projects.js";

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

const shortText = (max: number) => z.string().trim().max(max);
const textList = (maxItems: number, maxLen: number) => z.array(z.string().trim().min(1).max(maxLen)).max(maxItems);

export const TemplateSourceReferenceSchema = z.object({
  excerpt: z.string().trim().min(1).max(2000),
  page: z.number().int().positive().optional(),
  headingPath: z.array(z.string().max(300)).max(8).optional(),
});

export const RequiredTableSchema = z.object({
  title: z.string().trim().min(1).max(300),
  columns: textList(30, 200).default([]),
  notes: shortText(1000).optional(),
});

export const TemplateSectionSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().trim().min(2, "Section title must be at least 2 characters").max(300),
    description: shortText(4000).default(""),
    inputType: SectionInputTypeSchema.default("NARRATIVE"),
    required: z.boolean().default(true),
    evidenceNeeded: z
      .union([z.string().max(2000), textList(30, 500)])
      .default([])
      .transform((v) => (typeof v === "string" ? v.split(/[;\n]+/).map((x) => x.trim()).filter(Boolean) : v)),
    relatedLogframeElement: shortText(300).optional(),
    reviewStatus: SectionReviewStatusSchema.default("DRAFT"),
    minWords: z.number().int().optional(),
    maxWords: z.number().int().optional(),
    pageLimit: z.number().int().positive().optional(),
    parentId: z.string().optional(),
    level: z.number().int().min(1).max(4).default(1),
    numbering: shortText(40).optional(),
    instructions: shortText(8000).optional(),
    mandatoryQuestions: textList(40, 1000).default([]),
    requiredTables: z.array(RequiredTableSchema).max(20).default([]),
    authorInstructions: shortText(4000).optional(),
    includeInReport: z.boolean().default(true),
    source: TemplateSourceReferenceSchema.optional(),
    confidence: z.number().min(0).max(1).optional(),
  })
  .superRefine(wordLimits);
export type TemplateSectionInput = z.infer<typeof TemplateSectionSchema>;

export const ComplianceSeveritySchema = z.enum(["INFO", "WARN", "BLOCK"]);

export const TemplateRequirementsSchema = z.object({
  reportTitle: shortText(300).optional(),
  reportingFrequency: ReportingFrequencySchema.optional(),
  submission: z
    .object({
      instructions: textList(40, 2000).default([]),
      deadlineRule: shortText(500).optional(),
      deadlineOffsetDays: z.number().int().min(0).max(365).optional(),
      channel: shortText(300).optional(),
      format: shortText(300).optional(),
    })
    .default({}),
  formatting: z
    .object({
      rules: textList(40, 1000).default([]),
      maxPages: z.number().int().positive().max(1000).optional(),
      font: shortText(100).optional(),
    })
    .default({}),
  annexes: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().trim().min(1).max(300),
        required: z.boolean().default(true),
        description: shortText(2000).optional(),
        source: TemplateSourceReferenceSchema.optional(),
      }),
    )
    .max(60)
    .default([]),
  indicatorRequirements: z
    .array(
      z.object({
        id: z.string().optional(),
        text: z.string().trim().min(1).max(2000),
        disaggregation: textList(20, 100).default([]),
        source: TemplateSourceReferenceSchema.optional(),
      }),
    )
    .max(60)
    .default([]),
  compliance: z
    .array(
      z.object({
        id: z.string().optional(),
        text: z.string().trim().min(1).max(2000),
        severity: ComplianceSeveritySchema.default("WARN"),
        source: TemplateSourceReferenceSchema.optional(),
      }),
    )
    .max(80)
    .default([]),
  generalInstructions: textList(40, 2000).default([]),
});
export type TemplateRequirementsPayload = z.infer<typeof TemplateRequirementsSchema>;

export const CreateDonorTemplateSchema = z.object({
  projectId: z.string().min(1),
  templateName: z.string().trim().min(1).max(200),
  donorName: z.string().trim().min(1).max(200),
  reportType: ReportTypeSchema,
  language: z.string().min(2).max(10).default("en"),
  requiredAnnexes: z.array(z.string().trim().min(1).max(300)).max(60).default([]),
  notes: z.string().max(2000).optional(),
  extractedRawText: z.string().max(500_000).optional(),
  /** Storage key returned by POST /v1/templates/files; the api attaches it. */
  originalFileKey: z.string().max(500).optional(),
  sections: z.array(TemplateSectionSchema).max(200).default([]),
  requirements: TemplateRequirementsSchema.optional(),
});
export type CreateDonorTemplateInput = z.infer<typeof CreateDonorTemplateSchema>;

export const UpdateTemplateSectionsSchema = z.object({
  sections: z.array(TemplateSectionSchema).max(200),
  expectedVersion: z.number().int().positive().optional(),
});
export type UpdateTemplateSectionsInput = z.infer<typeof UpdateTemplateSectionsSchema>;

export const UpdateTemplateRequirementsSchema = z.object({
  requirements: TemplateRequirementsSchema,
  expectedVersion: z.number().int().positive().optional(),
});
export type UpdateTemplateRequirementsInput = z.infer<typeof UpdateTemplateRequirementsSchema>;

export const UpdateTemplateMetadataSchema = z.object({
  templateName: z.string().trim().min(1).max(200).optional(),
  donorName: z.string().trim().min(1).max(200).optional(),
  reportType: ReportTypeSchema.optional(),
  language: z.string().min(2).max(10).optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export type UpdateTemplateMetadataInput = z.infer<typeof UpdateTemplateMetadataSchema>;

export const ReextractTemplateSchema = z.object({
  mode: z.enum(["replace", "merge"]).default("merge"),
  /** Replace the stored text before extracting (e.g. corrected paste). */
  rawText: z.string().max(500_000).optional(),
});
export type ReextractTemplateInput = z.infer<typeof ReextractTemplateSchema>;

export const CloneTemplateSchema = z.object({
  projectId: z.string().min(1),
});
export type CloneTemplateInput = z.infer<typeof CloneTemplateSchema>;

export const SetTemplateLibrarySchema = z.object({
  isLibrary: z.boolean(),
});

export const RegionUpdateSchema = z.object({
  regionId: z.string().min(1),
  templateSectionId: z.string().min(1),
  placeholderKey: z.string().min(1),
});
export type RegionUpdate = z.infer<typeof RegionUpdateSchema>;
export const UpdateTemplateMappingSchema = z.object({
  regionUpdates: z.array(RegionUpdateSchema).min(1),
});
export type UpdateTemplateMappingInput = z.infer<typeof UpdateTemplateMappingSchema>;

export const LockTemplateMappingSchema = z.object({
  mappingId: z.string().min(1),
});
export type LockTemplateMappingInput = z.infer<typeof LockTemplateMappingSchema>;
