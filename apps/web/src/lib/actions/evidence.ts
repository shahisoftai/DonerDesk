"use server";

import { z } from "zod";
import { AcceptEvidenceTagsSchema, ImportEvidenceTextSchema, SetEvidencePeriodSchema } from "@donordesk/contracts";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { idempotency, type CreateOptions } from "./_idempotency";
import { EvidenceLinkSuggestionsResponseSchema, OkResponseSchema, UploadResponseSchema } from "./_schemas";
import { ImportEvidenceResponseSchema, type ImportEvidenceResponse } from "@/lib/server/schemas";

export type ImportEvidenceResult = Result<ImportEvidenceResponse, AppError>;

/** Auto-parses evidence metadata (Title/File Name/Evidence Type/Drive Web Link) and creates link-first records. */
export async function importEvidenceTextAction(input: unknown): Promise<ImportEvidenceResult> {
  const context = await requireSession();
  const parsed = ImportEvidenceTextSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) },
    };
  }
  return gatewayRequest("/v1/evidence/import", ImportEvidenceResponseSchema, context.token, {
    method: "POST",
    body: parsed.data,
  });
}

export type UploadEvidenceResult = Result<{ id: string; fileUrl: string }, AppError>;

export async function uploadEvidenceAction(formData: FormData, options: CreateOptions = {}): Promise<UploadEvidenceResult> {
  const context = await requireSession();

  const projectId = String(formData.get("projectId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const evidenceType = String(formData.get("evidenceType") ?? "").trim();
  const file = formData.get("file");

  const fields: Record<string, string[]> = {};
  if (!projectId) fields.projectId = ["Project is required."];
  if (!title) fields.title = ["Title is required."];
  if (!evidenceType) fields.evidenceType = ["Evidence type is required."];
  if (!(file instanceof File) || file.size === 0) {
    fields.file = ["Please select a non-empty file."];
  }
  if (Object.keys(fields).length > 0) {
    return {
      ok: false,
      error: { kind: "validation", message: "Please correct the highlighted fields.", fields },
    };
  }

  return gatewayRequest("/v1/evidence/upload", UploadResponseSchema, context.token, {
    method: "POST",
    formData,
    ...idempotency(options),
  });
}

export type AcceptEvidenceTagsResult = Result<undefined, AppError>;

export async function acceptEvidenceTagsAction(
  evidenceId: string,
  indices: number[],
): Promise<AcceptEvidenceTagsResult> {
  const context = await requireSession();
  const parsed = AcceptEvidenceTagsSchema.safeParse({ indices });
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) },
    };
  }
  const result = await gatewayRequest(`/v1/evidence/${evidenceId}/accept-tags`, OkResponseSchema, context.token, {
    method: "POST",
    body: parsed.data,
  });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}

export type VerifyEvidenceResult = Result<undefined, AppError>;

export async function verifyEvidenceAction(evidenceId: string): Promise<VerifyEvidenceResult> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/evidence/${evidenceId}/verify`, OkResponseSchema, context.token, {
    method: "POST",
  });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}

export type EvidenceLinkSuggestion = {
  evidenceId: string;
  targetType: "activity" | "indicator";
  targetId: string;
  targetLabel: string;
  score: number;
  reason?: string;
};

export type SuggestEvidenceLinksResult = Result<EvidenceLinkSuggestion[], AppError>;

/**
 * Suggests activities/indicator updates this evidence file likely belongs to,
 * by title similarity. Never attaches anything itself — the caller must
 * confirm via attachEvidenceAction so evidence linkage always requires an
 * explicit user decision.
 */
export async function suggestEvidenceLinksAction(evidenceId: string): Promise<SuggestEvidenceLinksResult> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/evidence/${evidenceId}/suggest-links`, EvidenceLinkSuggestionsResponseSchema, context.token);
  if (!result.ok) return result;
  return { ok: true, value: result.value.suggestions };
}

export type SetEvidencePeriodResult = Result<undefined, AppError>;

/**
 * Links an evidence file to a reporting period (or unlinks it with null) so
 * the period's readiness "Evidence" score and generation evidence packages
 * include it.
 */
export type BulkVerifyEvidenceResult = Result<{ succeeded: number; failed: number; results: Array<{ evidenceId: string; ok: boolean; error?: string }> }, AppError>;

/** Verifies many files at once; one result per file. */
export async function bulkVerifyEvidenceAction(evidenceIds: string[]): Promise<BulkVerifyEvidenceResult> {
  const context = await requireSession();
  const schema = z.object({
    succeeded: z.number(),
    failed: z.number(),
    results: z.array(z.object({ evidenceId: z.string(), ok: z.boolean(), error: z.string().optional() })),
  });
  return gatewayRequest("/v1/evidence/bulk-verify", schema, context.token, { method: "POST", body: { evidenceIds } });
}

export async function setEvidencePeriodAction(evidenceId: string, reportingPeriodId: string | null): Promise<SetEvidencePeriodResult> {
  const context = await requireSession();
  const parsed = SetEvidencePeriodSchema.safeParse({ reportingPeriodId });
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) },
    };
  }
  const result = await gatewayRequest(`/v1/evidence/${evidenceId}/period`, OkResponseSchema, context.token, {
    method: "POST",
    body: parsed.data,
  });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}
