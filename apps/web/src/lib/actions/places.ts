"use server";

import { CreatePlaceSchema, ImportPlacesSchema, UpdatePlaceSchema } from "@donordesk/contracts";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { IdResponseSchema, OkResponseSchema } from "./_schemas";
import { PlaceImportPreviewSchema, PlaceResultsSchema, type PlaceImportPreview, type PlaceResults } from "@/lib/server/schemas-places";

const invalid = (error: { issues: unknown[] } & Parameters<typeof flattenZodFields>[0]) => ({
  ok: false as const,
  error: { kind: "validation" as const, message: "Please correct the highlighted fields.", fields: flattenZodFields(error) },
});

export async function createPlaceAction(input: unknown): Promise<Result<{ id: string }, AppError>> {
  const context = await requireSession();
  const parsed = CreatePlaceSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return gatewayRequest("/v1/places", IdResponseSchema, context.token, { method: "POST", body: parsed.data });
}

export async function updatePlaceAction(placeId: string, input: unknown): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const parsed = UpdatePlaceSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const result = await gatewayRequest(`/v1/places/${encodeURIComponent(placeId)}`, OkResponseSchema, context.token, { method: "PUT", body: parsed.data });
  return result.ok ? { ok: true, value: undefined } : result;
}

export async function setPlaceRetiredAction(placeId: string, retired: boolean): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/places/${encodeURIComponent(placeId)}/${retired ? "archive" : "restore"}`, OkResponseSchema, context.token, { method: "POST", body: {} });
  return result.ok ? { ok: true, value: undefined } : result;
}

/** `apply: false` previews; nothing is saved until the person confirms. */
export async function importPlacesAction(input: unknown): Promise<Result<PlaceImportPreview, AppError>> {
  const context = await requireSession();
  const parsed = ImportPlacesSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return gatewayRequest("/v1/places/import", PlaceImportPreviewSchema, context.token, { method: "POST", body: parsed.data });
}

/** Each indicator's recorded per-location values read at one level of the place tree. */
export async function getPlaceResultsAction(projectId: string, level: number): Promise<Result<PlaceResults, AppError>> {
  const context = await requireSession();
  return gatewayRequest(`/v1/projects/${encodeURIComponent(projectId)}/place-results?level=${encodeURIComponent(String(level))}`, PlaceResultsSchema, context.token);
}
