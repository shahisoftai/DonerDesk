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

