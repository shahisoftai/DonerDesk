import { z } from "zod";

export const EvidenceTypeSchema = z.enum([
  "ATTENDANCE_SHEET",
  "PHOTO",
  "DISTRIBUTION_LIST",
  "TRAINING_RECORD",
  "FIELD_VISIT_REPORT",
  "MONITORING_REPORT",
  "KOBO_ODK_EXPORT",
  "PROCUREMENT_DOCUMENT",
  "APPROVAL_DOCUMENT",
  "BENEFICIARY_LIST",
  "MEETING_MINUTES",
  "CASE_STUDY",
  "FINANCIAL_DOCUMENT",
  "SUPPLIER_DOCUMENT",
  "DONOR_COMMUNICATION",
  "OTHER",
]);

export const ConfidentialityLevelSchema = z.enum(["PUBLIC", "INTERNAL", "SENSITIVE", "HIGHLY_SENSITIVE"]);

export const EvidenceVerificationStatusSchema = z.enum([
  "UPLOADED",
  "AI_TAGGED",
  "PENDING_REVIEW",
  "VERIFIED",
  "NEEDS_CORRECTION",
  "REJECTED",
  "ARCHIVED",
]);

export const StorageProviderSchema = z.enum(["LOCAL", "GOOGLE_DRIVE", "R2"]);

export const CreateEvidenceSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1).max(300),
  fileName: z.string().min(1).max(300),
  fileUrl: z.string().optional(),
  fileType: z.string().min(1).max(100),
  fileSize: z.number().int().nonnegative().max(100 * 1024 * 1024),
  storageProvider: StorageProviderSchema.default("LOCAL"),
  driveFileId: z.string().optional(),
  driveWebLink: z.string().optional(),
  evidenceType: EvidenceTypeSchema,
  reportingPeriodId: z.string().optional(),
  activityId: z.string().optional(),
  indicatorId: z.string().optional(),
  location: z.string().max(200).optional(),
  activityDate: z.string().datetime().optional(),
  confidentialityLevel: ConfidentialityLevelSchema.default("INTERNAL"),
  notes: z.string().max(2000).optional(),
});
export type CreateEvidenceInput = z.infer<typeof CreateEvidenceSchema>;

export const UpdateEvidenceSchema = CreateEvidenceSchema.partial();
export const AcceptEvidenceTagsSchema = z.object({
  indices: z.array(z.number().int().nonnegative()),
});

export const EvidenceSearchSchema = z.object({
  query: z.string().optional(),
  projectId: z.string().optional(),
  reportingPeriodId: z.string().optional(),
  activityId: z.string().optional(),
  indicatorId: z.string().optional(),
  evidenceType: EvidenceTypeSchema.optional(),
  location: z.string().optional(),
  uploadedById: z.string().optional(),
  verificationStatus: EvidenceVerificationStatusSchema.optional(),
  confidentialityLevel: ConfidentialityLevelSchema.optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(20),
});
