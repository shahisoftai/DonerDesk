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

export type CreateExportResult = Result<{ id: string; fileUrl: string }, AppError>;

export async function createExportAction(input: unknown): Promise<CreateExportResult> {
  const context = await requireSession();
  const parsed = CreateExportSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) },
    };
  }
  return gatewayRequest("/v1/exports", UploadResponseSchema, context.token, {
    method: "POST",
    body: parsed.data,
  });
}

export type GetExportPreflightResult = Result<z.infer<typeof ExportPreflightSchema>, AppError>;

export async function getExportPreflightAction(periodId: string): Promise<GetExportPreflightResult> {
  const context = await requireSession();
  return gatewayRequest(`/v1/reporting-periods/${periodId}/export-preflight`, ExportPreflightSchema, context.token);
}
