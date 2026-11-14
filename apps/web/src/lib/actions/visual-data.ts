"use server";

import { AddDataAlertSchema, QueryVisualDataSchema } from "@donordesk/contracts";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { OkResponseSchema } from "./_schemas";
import { DataAlertSchema, type DataAlertView, CatalogueSchema, VersionsSchema, VisualAnswerSchema, type CatalogueView, type VersionsView, type VisualAnswerView } from "@/lib/server/schemas-visual-data";

/** The Data panel's list of sources and fields (and a search over them). */
export async function getVisualCatalogueAction(search?: string, projectId?: string): Promise<Result<CatalogueView, AppError>> {
  const context = await requireSession();
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (projectId) params.set("projectId", projectId);
  return gatewayRequest(`/v1/visual-data/catalogue${params.size ? `?${params}` : ""}`, CatalogueSchema, context.token);
}

/** One question about one project, answered as a table or as a sentence saying why not. */
export async function queryVisualDataAction(input: unknown): Promise<Result<VisualAnswerView, AppError>> {
  const parsed = QueryVisualDataSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { kind: "validation", message: "This question could not be understood.", fields: flattenZodFields(parsed.error), retryable: false } as AppError };
  const context = await requireSession();
  return gatewayRequest("/v1/visual-data/query", VisualAnswerSchema, context.token, { method: "POST", body: parsed.data });
}

/** Only version numbers: cheap enough to ask every 30 seconds. */
export async function getVisualDataVersionsAction(projectIds: string[]): Promise<Result<VersionsView, AppError>> {
  const context = await requireSession();
  return gatewayRequest(`/v1/visual-data/version?projects=${encodeURIComponent(projectIds.join(","))}`, VersionsSchema, context.token);
}

/** A person's own threshold alerts: a rule on one indicator, told once when the figure crosses. */
export async function addDataAlertAction(input: unknown): Promise<Result<DataAlertView, AppError>> {
  const parsed = AddDataAlertSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { kind: "validation", message: "This alert could not be understood.", fields: flattenZodFields(parsed.error), retryable: false } as AppError };
  const context = await requireSession();
  return gatewayRequest("/v1/visual-data/alerts", DataAlertSchema, context.token, { method: "POST", body: parsed.data });
}

export async function removeDataAlertAction(id: string): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/visual-data/alerts/${encodeURIComponent(id)}`, OkResponseSchema, context.token, { method: "DELETE" });
  return result.ok ? { ok: true, value: undefined } : result;
}
