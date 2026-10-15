"use server";

import { AddSectionDataChartSchema, UpdateSectionDataChartSchema, type AddSectionDataChartInput, type UpdateSectionDataChartInput } from "@donordesk/contracts";
import { z } from "zod";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { DataSheetResponseSchema, ReportDraftResponseSchema, SectionDataChartsResponseSchema, type DataSheetResponse, type SectionDataChart } from "@/lib/server/schemas";

const IdSchema = z.object({ id: z.string() });
const OkSchema = z.object({ removed: z.literal(true).optional(), moved: z.boolean().optional(), id: z.string().optional() });

const invalid = (error: z.ZodError): Result<never, AppError> => ({ ok: false, error: { kind: "validation", message: "Please check the chart settings.", fields: flattenZodFields(error) } });
const base = (sectionId: string): string => `/v1/report-sections/${encodeURIComponent(sectionId)}/data-charts`;

export async function getDataSheetAction(projectId: string): Promise<Result<DataSheetResponse, AppError>> {
  const context = await requireSession();
  return gatewayRequest(`/v1/projects/${encodeURIComponent(projectId)}/data-sheet`, DataSheetResponseSchema, context.token);
}

export type DraftSectionChoices = { draftId: string | null; draftStatus: string | null; sections: Array<{ id: string; title: string; approved: boolean }> };

/** The sections of a period's report, for choosing where a chart goes. */
export async function getDraftSectionChoicesAction(periodId: string): Promise<Result<DraftSectionChoices, AppError>> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/reporting-periods/${encodeURIComponent(periodId)}/draft`, ReportDraftResponseSchema, context.token);
  if (!result.ok) return result;
  const { draft, sections } = result.value;
  return {
    ok: true,
    value: {
      draftId: draft?.id ?? null,
      draftStatus: draft?.status ?? null,
      sections: [...(sections ?? [])].sort((a, b) => a.sectionOrder - b.sectionOrder).map((s) => ({ id: s.id, title: s.numbering && !s.sectionTitle.startsWith(s.numbering) ? `${s.numbering} ${s.sectionTitle}` : s.sectionTitle, approved: s.status === "APPROVED" })),
    },
  };
}

export async function listSectionDataChartsAction(sectionId: string): Promise<Result<SectionDataChart[], AppError>> {
  const context = await requireSession();
  const result = await gatewayRequest(base(sectionId), SectionDataChartsResponseSchema, context.token);
  return result.ok ? { ok: true, value: result.value.items } : result;
}

export async function addSectionDataChartAction(sectionId: string, input: AddSectionDataChartInput): Promise<Result<{ id: string }, AppError>> {
  const context = await requireSession();
  const parsed = AddSectionDataChartSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return gatewayRequest(base(sectionId), IdSchema, context.token, { method: "POST", body: parsed.data });
}

export async function updateSectionDataChartAction(sectionId: string, chartId: string, input: UpdateSectionDataChartInput): Promise<Result<{ id: string }, AppError>> {
  const context = await requireSession();
  const parsed = UpdateSectionDataChartSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return gatewayRequest(`${base(sectionId)}/${encodeURIComponent(chartId)}`, IdSchema, context.token, { method: "PUT", body: parsed.data });
}

export async function refreshSectionDataChartAction(sectionId: string, chartId: string): Promise<Result<{ id: string }, AppError>> {
  const context = await requireSession();
  return gatewayRequest(`${base(sectionId)}/${encodeURIComponent(chartId)}/refresh`, IdSchema, context.token, { method: "POST" });
}

export async function moveSectionDataChartAction(sectionId: string, chartId: string, direction: "UP" | "DOWN"): Promise<Result<{ moved: boolean }, AppError>> {
  const context = await requireSession();
  const result = await gatewayRequest(`${base(sectionId)}/${encodeURIComponent(chartId)}/move`, OkSchema, context.token, { method: "POST", body: { direction } });
  return result.ok ? { ok: true, value: { moved: result.value.moved ?? false } } : result;
}

export async function removeSectionDataChartAction(sectionId: string, chartId: string): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const result = await gatewayRequest(`${base(sectionId)}/${encodeURIComponent(chartId)}`, OkSchema, context.token, { method: "DELETE" });
  return result.ok ? { ok: true, value: undefined } : result;
}
