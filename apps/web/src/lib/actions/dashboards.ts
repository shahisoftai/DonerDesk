"use server";

import { AddDashboardWidgetSchema, CreateDashboardShareSchema, SaveDashboardSchema } from "@donordesk/contracts";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { OkResponseSchema } from "./_schemas";
import {
  AddedChartSchema, DashboardDataSchema, DashboardLinkCreatedSchema, DashboardLinkListSchema, DashboardListSchema, SavedDashboardSchema,
  type ChartDrawing, type DashboardLinkView, type DashboardSummary,
} from "@/lib/server/schemas-dashboards";

const invalid = (error: Parameters<typeof flattenZodFields>[0]) => ({
  ok: false as const,
  error: { kind: "validation" as const, message: "Please correct the highlighted fields.", fields: flattenZodFields(error) },
});
const enc = encodeURIComponent;

export async function listDashboardsAction(projectId?: string): Promise<Result<DashboardSummary[], AppError>> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/dashboards${projectId ? `?projectId=${enc(projectId)}` : ""}`, DashboardListSchema, context.token);
  return result.ok ? { ok: true, value: result.value.dashboards } : result;
}

export async function saveDashboardAction(input: unknown, dashboardId?: string): Promise<Result<{ id: string; updatedAt: string }, AppError>> {
  const context = await requireSession();
  const parsed = SaveDashboardSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return gatewayRequest(dashboardId ? `/v1/dashboards/${enc(dashboardId)}` : "/v1/dashboards", SavedDashboardSchema, context.token, { method: dashboardId ? "PUT" : "POST", body: parsed.data });
}

export async function addDashboardChartAction(dashboardId: string, input: unknown): Promise<Result<{ chartCount: number }, AppError>> {
  const context = await requireSession();
  const parsed = AddDashboardWidgetSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return gatewayRequest(`/v1/dashboards/${enc(dashboardId)}/charts`, AddedChartSchema, context.token, { method: "POST", body: parsed.data });
}

export async function deleteDashboardAction(dashboardId: string): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/dashboards/${enc(dashboardId)}`, OkResponseSchema, context.token, { method: "DELETE" });
  return result.ok ? { ok: true, value: undefined } : result;
}

export async function getDashboardChartsAction(dashboardId: string): Promise<Result<ChartDrawing[], AppError>> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/dashboards/${enc(dashboardId)}/data`, DashboardDataSchema, context.token);
  return result.ok ? { ok: true, value: result.value.charts } : result;
}

export async function listDashboardLinksAction(dashboardId: string): Promise<Result<DashboardLinkView[], AppError>> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/dashboards/${enc(dashboardId)}/links`, DashboardLinkListSchema, context.token);
  return result.ok ? { ok: true, value: result.value.links } : result;
}

/** The token is in the answer once; the page shows it as a link and never stores it. */
export async function createDashboardLinkAction(dashboardId: string, input: unknown): Promise<Result<{ id: string; token: string; expiresAt: string }, AppError>> {
  const context = await requireSession();
  const parsed = CreateDashboardShareSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return gatewayRequest(`/v1/dashboards/${enc(dashboardId)}/links`, DashboardLinkCreatedSchema, context.token, { method: "POST", body: parsed.data });
}

export async function revokeDashboardLinkAction(linkId: string): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/dashboard-links/${enc(linkId)}/revoke`, OkResponseSchema, context.token, { method: "POST", body: {} });
  return result.ok ? { ok: true, value: undefined } : result;
}
