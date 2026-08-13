import { z } from "zod";

/**
 * Internal (service-to-service) contracts used by Kestra flows and the
 * DonorDesk workers to call the API's /internal/* routes.
 *
 * These contracts are intentionally thin: they describe the wire format only.
 * Business rules live in the application layer; the API adapts the wire shape
 * to/from domain types.
 */

export const SuggestedTagSchema = z.object({
  field: z.enum(["evidenceType", "activityId", "indicatorId", "reportingPeriodId", "location"]),
  value: z.string().min(1),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
  accepted: z.boolean().default(false),
});
export type SuggestedTag = z.infer<typeof SuggestedTagSchema>;

/**
 * Payload returned by `GET /internal/evidence/:id`. Includes enough metadata
 * (fileUrl / storageKey) for a worker or flow to fetch and parse the file.
 */
export const InternalEvidenceResponseSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  reportingPeriodId: z.string().optional(),
  activityId: z.string().optional(),
  indicatorId: z.string().optional(),
  fileName: z.string().min(1),
  title: z.string().min(1),
  fileUrl: z.string().min(1),
  storageKey: z.string().min(1),
  fileType: z.string().min(1),
  fileSize: z.number().int().nonnegative(),
  evidenceType: z.string().min(1),
  location: z.string().optional(),
  activityDate: z.string().optional(),
  uploadedById: z.string().min(1),
  verificationStatus: z.string().min(1),
  confidentialityLevel: z.string().min(1),
  notes: z.string().optional(),
  aiSuggestedTags: z.array(SuggestedTagSchema).default([]),
});
export type InternalEvidenceResponse = z.infer<typeof InternalEvidenceResponseSchema>;

/**
 * Payload accepted by `POST /internal/evidence/:id/tags`. Mirrors the output of
 * the workers `/v1/suggest-tags` route so the flow can forward it unchanged.
 */
export const PersistTagsBodySchema = z.object({
  summary: z.string().default(""),
  tags: z.array(SuggestedTagSchema).default([]),
  sensitivityWarning: z.string().optional(),
  model: z.string().optional(),
  idempotencyKey: z.string().min(1).optional(),
});
export type PersistTagsBody = z.infer<typeof PersistTagsBodySchema>;

/**
 * Payload accepted by `POST /internal/evidence/upload` for inbound connectors
 * (Google Drive, SFTP). The file bytes are carried as Base64 so the JSON body
 * can be signed with the same HMAC scheme as the other /internal/* routes. This
 * is a convenience for Phase-1 inbound ingestion; large media should move to a
 * dedicated streaming/signed-URL contract.
 */
export const InternalEvidenceUploadSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1).max(300),
  fileName: z.string().min(1).max(300),
  fileType: z.string().min(1).max(100),
  evidenceType: z.string().min(1),
  reportingPeriodId: z.string().optional(),
  activityId: z.string().optional(),
  indicatorId: z.string().optional(),
  location: z.string().max(200).optional(),
  activityDate: z.string().datetime().optional(),
  confidentialityLevel: z.string().default("INTERNAL"),
  notes: z.string().max(2000).optional(),
  fileBase64: z.string().min(1),
});
export type InternalEvidenceUpload = z.infer<typeof InternalEvidenceUploadSchema>;

/**
 * Canonical set of async job classes that Kestra/BullMQ/workers own. A single
 * enum is the source of truth so the job queue adapters, the dispatcher, and
 * the flow definitions all refer to the same names (OCP: add a name here and
 * a row to the flow mapping table to introduce a new job class).
 */
export const JOB_NAMES = [
  "evidence.ingest",
  "evidence.suggest_tags",
  "activity.polish",
  "report.draft_section",
  "readiness.recompute",
  "checklist.generate",
  "export.run",
  "reminder.deadline",
] as const;
export type JobName = (typeof JOB_NAMES)[number];
export const JobNameSchema = z.enum(JOB_NAMES);

/**
 * Generic envelope for async jobs handed to the job queue (Phase C). Defined
 * here so the wire format is versioned and shared before the queue adapters land.
 */
export const JobEnvelopeSchema = z.object({
  jobName: JobNameSchema,
  flowId: z.string().optional(),
  payload: z.record(z.string(), z.unknown()),
  idempotencyKey: z.string().optional(),
  timestamp: z.string().datetime().optional(),
});
export type JobEnvelope = z.infer<typeof JobEnvelopeSchema>;
