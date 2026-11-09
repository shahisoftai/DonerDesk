"use server";

import { QueryVisualDataSchema } from "@donordesk/contracts";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { CatalogueSchema, VersionsSchema, VisualAnswerSchema, type CatalogueView, type VersionsView, type VisualAnswerView } from "@/lib/server/schemas-visual-data";

/** The Data panel's list of sources and fields (and a search over them). */
export async function getVisualCatalogueAction(search?: string): Promise<Result<CatalogueView, AppError>> {
  const context = await requireSession();
  return gatewayRequest(`/v1/visual-data/catalogue${search ? `?search=${encodeURIComponent(search)}` : ""}`, CatalogueSchema, context.token);
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
