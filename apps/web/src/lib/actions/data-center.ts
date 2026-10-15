"use server";

import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { DataSheetImportResponseSchema, type DataSheetImportResponse } from "@/lib/server/schemas";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";

const MAX_BYTES = 10 * 1024 * 1024;

export type ImportDataSheetResult = Result<DataSheetImportResponse, AppError>;

/** Reads a CSV or XLSX data sheet against the project. `apply: false` only previews; nothing is saved. */
export async function importDataSheetAction(projectId: string, file: File, apply: boolean): Promise<ImportDataSheetResult> {
  const context = await requireSession();
  if (!file || file.size === 0) return { ok: false, error: { kind: "validation", message: "Please select a non-empty file.", fields: {} } };
  if (file.size > MAX_BYTES) return { ok: false, error: { kind: "validation", message: "The file is larger than 10 MB.", fields: {} } };
  if (!/\.(csv|xlsx)$/i.test(file.name)) return { ok: false, error: { kind: "validation", message: "Upload a .csv or .xlsx file.", fields: {} } };
  const formData = new FormData();
  // Fields before the file: the API reads `apply` from the multipart stream once it reaches the file.
  formData.set("apply", apply ? "true" : "false");
  formData.set("file", file);
  return gatewayRequest(`/v1/projects/${encodeURIComponent(projectId)}/data-sheet/import`, DataSheetImportResponseSchema, context.token, { method: "POST", formData, timeoutMs: 120_000 });
}
