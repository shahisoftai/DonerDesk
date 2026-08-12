import { z } from "zod";

export const ChecklistItemTypeSchema = z.enum([
  "MISSING_EVIDENCE",
  "INCOMPLETE_EVIDENCE_METADATA",
  "UNVERIFIED_INDICATOR",
  "UNSUPPORTED_REPORT_CLAIM",
  "MISSING_ANNEX",
  "MISSING_PROCUREMENT_DOCUMENT",
  "MISSING_APPROVAL",
  "MISSING_DISAGGREGATION",
  "LATE_ACTIVITY_UPDATE",
  "SENSITIVE_DATA_WARNING",
  "UNREVIEWED_AI_OUTPUT",
]);

export const SeveritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const ChecklistStatusSchema = z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "ACCEPTED_RISK", "NOT_APPLICABLE"]);

export const CreateChecklistItemSchema = z.object({
  projectId: z.string().min(1),
  reportingPeriodId: z.string().min(1),
  type: ChecklistItemTypeSchema,
  title: z.string().min(1).max(300),
  description: z.string().max(2000).default(""),
  severity: SeveritySchema,
  relatedEntityType: z.string().optional(),
  relatedEntityId: z.string().optional(),
  assignedToId: z.string().optional(),
  dueDate: z.string().datetime().optional(),
});
export type CreateChecklistItemInput = z.infer<typeof CreateChecklistItemSchema>;

export const ResolveChecklistItemSchema = z.object({
  decision: z.enum(["RESOLVE", "ACCEPT_RISK", "NOT_APPLICABLE", "START"]),
  notes: z.string().max(2000).optional(),
});
