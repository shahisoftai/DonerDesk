"use server";

import { z } from "zod";
import { CreateExportSchema } from "@donordesk/contracts";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import { ExportPreflightSchema } from "@/lib/server/schemas";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { UploadResponseSchema } from "./_schemas";

const CreatedExportSchema = UploadResponseSchema.extend({ fileName: z.string().optional() });
const SnapshotCreatedSchema = z.object({ id: z.string() });

export type CreateExportResult = Result<{ id: string; fileUrl: string; fileName?: string }, AppError>;

/**
 * `donorDraftId` asks for the final copy for the donor: the report's submission snapshot is sealed first (the gate
 * runs there) and the export is bound to it, so the file carries no "internal preview" mark. Without it the export is
 * the watermarked internal copy.
 */
export async function createExportAction(input: unknown, donorDraftId?: string): Promise<CreateExportResult> {
  const context = await requireSession();
  if (donorDraftId) {
    const sealed = await gatewayRequest(`/v1/report-drafts/${donorDraftId}/submission-snapshot`, SnapshotCreatedSchema, context.token, { method: "POST", body: {} });
    if (!sealed.ok) return sealed;
    input = { ...(input as Record<string, unknown>), exportIntent: "DONOR_SUBMISSION", submissionSnapshotId: sealed.value.id };
  }
  const parsed = CreateExportSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) },
    };
  }
  return gatewayRequest("/v1/exports", CreatedExportSchema, context.token, {
    method: "POST",
    body: parsed.data,
  });
}

export type GetExportPreflightResult = Result<z.infer<typeof ExportPreflightSchema>, AppError>;

export async function getExportPreflightAction(periodId: string): Promise<GetExportPreflightResult> {
  const context = await requireSession();
  return gatewayRequest(`/v1/reporting-periods/${periodId}/export-preflight`, ExportPreflightSchema, context.token);
}
