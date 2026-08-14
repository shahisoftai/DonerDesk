import { z } from "zod";
import { EvidenceTypeSchema, ConfidentialityLevelSchema, StorageProviderSchema } from "./evidence.js";

/**
 * Contracts for the Google Drive storage onboarding (Phase C) and for linking
 * evidence files that live in the tenant's own Google Drive (no byte copy).
 */

export const GoogleDriveAuthUrlRequestSchema = z.object({});
export const GoogleDriveAuthUrlResponseSchema = z.object({
  authUrl: z.string().min(1),
  state: z.string().min(1),
});

export const GoogleDriveCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().optional(),
});
export type GoogleDriveCallbackInput = z.infer<typeof GoogleDriveCallbackSchema>;

export const GoogleDriveCallbackResponseSchema = z.object({
  ok: z.boolean(),
  storageProvider: StorageProviderSchema,
});

/** Link an existing Google Drive file as evidence (reference-only, no byte copy). */
export const LinkEvidenceSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1).max(300),
  fileName: z.string().min(1).max(300),
  fileType: z.string().min(1).max(100),
  driveFileId: z.string().min(1),
  driveWebLink: z.string().url().optional(),
  evidenceType: EvidenceTypeSchema,
  reportingPeriodId: z.string().optional(),
  activityId: z.string().optional(),
  indicatorId: z.string().optional(),
  location: z.string().max(200).optional(),
  activityDate: z.string().datetime().optional(),
  confidentialityLevel: ConfidentialityLevelSchema.default("INTERNAL"),
  notes: z.string().max(2000).optional(),
});
export type LinkEvidenceInput = z.infer<typeof LinkEvidenceSchema>;
