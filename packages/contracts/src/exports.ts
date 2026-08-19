import { z } from "zod";

export const ExportTypeSchema = z.enum(["WORD", "PDF", "EXCEL_INDICATORS", "EVIDENCE_CHECKLIST", "EVIDENCE_PACK_ZIP", "DONOR_TEMPLATE"]);

export const ExportIntentSchema = z.enum(["INTERNAL_REVIEW", "DONOR_SUBMISSION"]);

export const CreateExportSchema = z.object({
  projectId: z.string().min(1),
  reportingPeriodId: z.string().min(1),
  exportType: ExportTypeSchema,
  exportIntent: ExportIntentSchema.default("INTERNAL_REVIEW"),
  submissionSnapshotId: z.string().min(1).optional(),
  includeEvidenceIds: z.array(z.string()).default([]),
  includeSensitive: z.boolean().default(false),
});
export type CreateExportInput = z.infer<typeof CreateExportSchema>;
