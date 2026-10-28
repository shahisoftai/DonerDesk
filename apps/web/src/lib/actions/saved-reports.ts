"use server";

import { SaveReportSchema } from "@donordesk/contracts";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { OkResponseSchema } from "./_schemas";
import { SavedReportListSchema, SavedReportWrittenSchema, type SavedReportView } from "@/lib/server/schemas-saved-reports";

const enc = encodeURIComponent;

export async function listSavedReportsAction(projectId: string): Promise<Result<SavedReportView[], AppError>> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/saved-reports?projectId=${enc(projectId)}`, SavedReportListSchema, context.token);
  return result.ok ? { ok: true, value: result.value.reports } : result;
}

export async function saveReportAction(input: unknown, reportId?: string): Promise<Result<{ id: string; updatedAt: string }, AppError>> {
  const context = await requireSession();
  const parsed = SaveReportSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) } };
  return gatewayRequest(reportId ? `/v1/saved-reports/${enc(reportId)}` : "/v1/saved-reports", SavedReportWrittenSchema, context.token, { method: reportId ? "PUT" : "POST", body: parsed.data });
}

export async function deleteSavedReportAction(reportId: string): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/saved-reports/${enc(reportId)}`, OkResponseSchema, context.token, { method: "DELETE" });
  return result.ok ? { ok: true, value: undefined } : result;
}
