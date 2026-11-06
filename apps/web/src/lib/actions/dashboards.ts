"use server";

import { AddDashboardWidgetSchema, ApplyDashboardTemplateSchema, PreviewDashboardSchema, CreateDashboardShareSchema, DashboardTemplateBodySchema, SaveDashboardSchema } from "@donordesk/contracts";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { OkResponseSchema } from "./_schemas";
import {
  AddedChartSchema, DashboardDataSchema, DashboardLinkCreatedSchema, DashboardLinkListSchema, DashboardListSchema, SavedDashboardSchema,
  TemplateAppliedSchema, TemplateDetailSchema, TemplateListSchema, TemplateWrittenSchema,
  type ChartDrawing, type DashboardLinkView, type DashboardSummary, type TemplateApplied, type TemplateSummary,
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

export async function getDashboardChartsAction(dashboardId: string, periodId?: string): Promise<Result<ChartDrawing[], AppError>> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/dashboards/${enc(dashboardId)}/data${periodId ? `?periodId=${encodeURIComponent(periodId)}` : ""}`, DashboardDataSchema, context.token);
  return result.ok ? { ok: true, value: result.value.charts } : result;
}

/** Draws widgets that are not saved yet (a tile just added or changed in edit mode), for the person looking; nothing is saved. */
export async function previewDashboardChartsAction(widgets: unknown, periodId?: string): Promise<Result<ChartDrawing[], AppError>> {
  const context = await requireSession();
  const parsed = PreviewDashboardSchema.safeParse({ widgets, ...(periodId ? { periodId } : {}) });
  if (!parsed.success) return invalid(parsed.error);
  const result = await gatewayRequest("/v1/dashboard-preview", DashboardDataSchema, context.token, { method: "POST", body: parsed.data });
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

/* ---------- templates (Phase 34.3) ---------- */

export async function listDashboardTemplatesAction(): Promise<Result<TemplateSummary[], AppError>> {
  const context = await requireSession();
  const result = await gatewayRequest("/v1/dashboard-templates", TemplateListSchema, context.token);
  return result.ok ? { ok: true, value: result.value.templates } : result;
}

export async function getDashboardTemplateAction(id: string): Promise<Result<{ template: Record<string, unknown>; updatedAt?: string | undefined; canEdit: boolean }, AppError>> {
  const context = await requireSession();
  return gatewayRequest(`/v1/dashboard-templates/${enc(id)}`, TemplateDetailSchema, context.token);
}

export async function saveDashboardTemplateAction(input: unknown, templateId?: string): Promise<Result<{ id: string; updatedAt: string; revision: number }, AppError>> {
  const context = await requireSession();
  const parsed = DashboardTemplateBodySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return gatewayRequest(templateId ? `/v1/dashboard-templates/${enc(templateId)}` : "/v1/dashboard-templates", TemplateWrittenSchema, context.token, { method: templateId ? "PUT" : "POST", body: parsed.data });
}

export async function deleteDashboardTemplateAction(id: string): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/dashboard-templates/${enc(id)}`, OkResponseSchema, context.token, { method: "DELETE" });
  return result.ok ? { ok: true, value: undefined } : result;
}

export async function applyDashboardTemplateAction(templateId: string, input: unknown): Promise<Result<TemplateApplied, AppError>> {
  const context = await requireSession();
  const parsed = ApplyDashboardTemplateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return gatewayRequest(`/v1/dashboard-templates/${enc(templateId)}/apply`, TemplateAppliedSchema, context.token, { method: "POST", body: parsed.data });
}
