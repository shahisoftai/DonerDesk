"use server";

import { AcceptEvidenceTagsSchema, ImportEvidenceTextSchema } from "@donordesk/contracts";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { OkResponseSchema, UploadResponseSchema } from "./_schemas";
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

export async function uploadEvidenceAction(formData: FormData): Promise<UploadEvidenceResult> {
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
