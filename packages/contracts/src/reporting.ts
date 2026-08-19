import { z } from "zod";
import { ReportTypeSchema } from "./templates.js";

export const ReportStatusSchema = z.enum([
  "NOT_STARTED",
  "IN_PROGRESS",
  "EVIDENCE_COLLECTION",
  "DRAFT_GENERATED",
  "UNDER_REVIEW",
  "APPROVED",
  "SUBMITTED",
  "CLOSED",
]);

export const CreateReportingPeriodSchema = z
  .object({
    projectId: z.string().min(1),
    donorTemplateId: z.string().optional(),
    reportType: ReportTypeSchema,
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    deadline: z.string().datetime(),
    internalReviewDeadline: z.string().datetime().optional(),
    responsibleOfficerId: z.string().optional(),
  })
  .refine((d) => new Date(d.endDate).getTime() >= new Date(d.startDate).getTime(), {
    message: "endDate must be on or after startDate",
    path: ["endDate"],
  });
export type CreateReportingPeriodInput = z.infer<typeof CreateReportingPeriodSchema>;

export const GenerateDraftSchema = z
  .object({
    reportingPeriodId: z.string().min(1).optional(),
    templateId: z.string().optional(),
    includeSections: z.array(z.string()).optional(),
  })
  .strict();

export const UpdateSectionSchema = z.object({
  content: z.string(),
  sourceReferences: z
    .array(
      z.object({
        type: z.enum(["evidence", "activity", "indicator", "template"]),
        id: z.string(),
        label: z.string().optional(),
      }),
    )
    .default([]),
  unsupportedClaims: z.array(z.string()).default([]),
  /**
   * Optimistic concurrency token. When provided, the update is rejected with a
   * conflict if the section changed on the server after this token was issued.
   */
  expectedVersion: z.string().optional(),
});

export const CreateReportSectionSchema = z.object({
  reportDraftId: z.string().min(1),
  sectionTitle: z.string().min(1).max(300),
  /** Optional explicit position; defaults to the end of the draft when omitted. */
  sectionOrder: z.number().int().nonnegative().optional(),
});
export type CreateReportSectionInput = z.infer<typeof CreateReportSectionSchema>;

export const ReviewReportSchema = z.object({
  decision: z.enum(["APPROVE", "RETURN"]),
  notes: z.string().max(2000).optional(),
});

export const RejectReportSchema = z.object({
  notes: z.string().max(2000).optional(),
});

export const ResolveReportClaimSchema = z.object({
  resolution: z.enum(["ACCEPTED_WITH_LIMITATION", "EXCLUDED"]),
  notes: z.string().max(2000).optional(),
});

export const GenerateReportRunSchema = z.object({
  draftId: z.string().min(1),
});

export const ChartConfigSchema = z.object({
  type: z.enum(["BAR", "LINE", "PIE", "AREA", "RADAR", "GAUGE"]),
  dataBinding: z.enum(["INDICATOR_COMPARISON", "INDICATOR_ACHIEVEMENT", "STATUS_DISTRIBUTION"]),
  options: z.record(z.string(), z.unknown()).optional(),
});
export type ChartConfigInput = z.infer<typeof ChartConfigSchema>;

export const UpdateSectionChartSchema = z.object({
  chartConfig: ChartConfigSchema.nullable(),
  expectedVersion: z.string().optional(),
});

export const RequirementKindSchema = z.enum([
  "SECTION",
  "QUESTION",
  "FIELD",
  "INDICATOR",
  "ANNEX",
  "DECLARATION",
  "FINANCIAL",
  "SAFEGUARD",
  "APPROVAL",
  "DEADLINE",
  "FORMAT",
]);

export const RequirementSourceTypeSchema = z.enum([
  "AWARD",
  "AWARD_AMENDMENT",
  "SCHEDULE",
  "TEMPLATE",
  "MECHANISM",
  "DONOR_PACK",
  "ORGANIZATION_PROFILE",
  "BASELINE",
]);

export const ReportingRequirementSchema = z.object({
  id: z.string().min(1),
  key: z.string().min(1),
  kind: RequirementKindSchema,
  required: z.boolean(),
  severity: z.enum(["INFO", "WARNING", "BLOCKING"]),
  condition: z
    .object({
      field: z.string(),
      operator: z.enum(["equals", "not_equals"]),
      value: z.union([z.string(), z.boolean(), z.number()]),
    })
    .optional(),
  evidenceRule: z
    .object({
      verifiedRequired: z.boolean(),
      confidentialityPolicy: z.enum(["ANY", "NON_CONFIDENTIAL"]),
    })
    .optional(),
  wordLimit: z
    .object({ min: z.number().int().nonnegative().optional(), max: z.number().int().positive().optional() })
    .optional(),
  sourceReference: z.object({
    sourceType: RequirementSourceTypeSchema,
    sourceId: z.string().min(1),
    documentHash: z.string().optional(),
    effectiveFrom: z.string().optional(),
    effectiveTo: z.string().optional(),
    version: z.number().int().nonnegative(),
    label: z.string(),
  }),
  guidance: z.string().optional(),
});
export type ReportingRequirementInput = z.infer<typeof ReportingRequirementSchema>;

export const UpsertRequirementPackSchema = z.object({
  id: z.string().optional(),
  donorKey: z.string().min(4),
  mechanismKey: z.string().min(1),
  reportType: z.string().min(1),
  name: z.string().min(1),
  language: z.string().optional(),
  requirements: z.array(ReportingRequirementSchema).min(1),
});

export const UpsertAwardOverrideSchema = z.object({
  id: z.string().optional(),
  awardId: z.string().min(1),
  projectId: z.string().min(1),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().optional(),
  documentHash: z.string().optional(),
  requirements: z.array(ReportingRequirementSchema).min(1),
  sourceReference: z.object({
    sourceType: RequirementSourceTypeSchema,
    sourceId: z.string().min(1),
    documentHash: z.string().optional(),
    effectiveFrom: z.string().optional(),
    effectiveTo: z.string().optional(),
    version: z.number().int().nonnegative(),
    label: z.string(),
  }),
});

export const ReassessRevisionSchema = z.object({
  revisionId: z.string().optional(),
});

