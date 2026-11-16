"use server";

import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import {
  PlaceCellsResponseSchema, PlaceSheetImportResponseSchema, PlaceSheetResponseSchema,
  type PlaceCellsResponse, type PlaceSheetImportResponse, type PlaceSheetResponse,
} from "@/lib/server/schemas-place-entry";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";

const MAX_BYTES = 10 * 1024 * 1024;

/** One period's values by place (Phase 57): rows = places, columns = indicators measured by place. */
export async function getPlaceSheetAction(projectId: string, periodId?: string): Promise<Result<PlaceSheetResponse, AppError>> {
  const context = await requireSession();
  const query = periodId ? `?periodId=${encodeURIComponent(periodId)}` : "";
  return gatewayRequest(`/v1/projects/${encodeURIComponent(projectId)}/place-sheet${query}`, PlaceSheetResponseSchema, context.token);
}

/** Saves typed place cells; the server merges each into its value's stored breakdown, so places never overwrite each other. */
export async function setPlaceCellsAction(
  projectId: string,
  input: { periodId: string; handIn?: boolean; cells: Array<{ indicatorId: string; placeId: string; value: string; splits?: Array<{ dimension: string; category: string; value: string }>; expected?: string }> },
): Promise<Result<PlaceCellsResponse, AppError>> {
  const context = await requireSession();
  return gatewayRequest(`/v1/projects/${encodeURIComponent(projectId)}/place-cells`, PlaceCellsResponseSchema, context.token, { method: "POST", body: input });
}

/** Reads an uploaded by-place workbook against the period. `apply: false` only checks; any problem blocks the whole file. */
export async function importPlaceSheetAction(projectId: string, periodId: string, file: File, apply: boolean): Promise<Result<PlaceSheetImportResponse, AppError>> {
  const context = await requireSession();
  if (!file || file.size === 0) return { ok: false, error: { kind: "validation", message: "Please select a non-empty file.", fields: {} } };
  if (file.size > MAX_BYTES) return { ok: false, error: { kind: "validation", message: "The file is larger than 10 MB.", fields: {} } };
  if (!/\.xlsx$/i.test(file.name)) return { ok: false, error: { kind: "validation", message: "Upload an Excel file (.xlsx).", fields: {} } };
  const formData = new FormData();
  formData.set("apply", apply ? "true" : "false");
  formData.set("file", file);
  return gatewayRequest(`/v1/projects/${encodeURIComponent(projectId)}/place-sheet/import?periodId=${encodeURIComponent(periodId)}`, PlaceSheetImportResponseSchema, context.token, { method: "POST", formData, timeoutMs: 120_000 });
}
