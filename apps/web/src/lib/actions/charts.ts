"use server";

import { SaveChartSchema } from "@donordesk/contracts";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { OkResponseSchema } from "./_schemas";
import { ResolvedDatasetsSchema, SavedChartDetailSchema, SavedChartListSchema, SavedChartWrittenSchema, type SavedChartDetail, type SavedChartView } from "@/lib/server/schemas-charts";
import type { z } from "zod";

type Dataset = z.infer<typeof ResolvedDatasetsSchema>["datasets"][number];
const enc = encodeURIComponent;

/** Figures for the chart on screen: one named query against one project (the studio's own call; the server checks the project is visible). */
export async function resolveChartDatasetAction(projectId: string, query: unknown): Promise<Result<Dataset, AppError>> {
  const context = await requireSession();
  const result = await gatewayRequest("/v1/datasets/resolve", ResolvedDatasetsSchema, context.token, { method: "POST", body: { requests: [{ key: "chart", projectId, query }] } });
  if (!result.ok) return result;
  const only = result.value.datasets[0];
  return only ? { ok: true, value: only } : { ok: false, error: { kind: "unavailable", message: "No answer came back.", retryable: true } as AppError };
}

export async function listSavedChartsAction(projectId: string): Promise<Result<SavedChartView[], AppError>> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/charts?projectId=${enc(projectId)}`, SavedChartListSchema, context.token);
  return result.ok ? { ok: true, value: result.value.charts } : result;
}

/** One chart with its earlier versions. */
export async function getSavedChartAction(chartId: string): Promise<Result<SavedChartDetail, AppError>> {
  const context = await requireSession();
  return gatewayRequest(`/v1/charts/${enc(chartId)}`, SavedChartDetailSchema, context.token);
}

export async function saveChartAction(input: unknown, chartId?: string): Promise<Result<{ id: string; updatedAt: string }, AppError>> {
  const context = await requireSession();
  const parsed = SaveChartSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) } };
  return gatewayRequest(chartId ? `/v1/charts/${enc(chartId)}` : "/v1/charts", SavedChartWrittenSchema, context.token, { method: chartId ? "PUT" : "POST", body: parsed.data });
}

export async function deleteChartAction(chartId: string): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/charts/${enc(chartId)}`, OkResponseSchema, context.token, { method: "DELETE" });
  return result.ok ? { ok: true, value: undefined } : result;
}
