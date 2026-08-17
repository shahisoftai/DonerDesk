"use server";

import { CreateReportingPeriodSchema, UpdateSectionSchema } from "@donordesk/contracts";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import {
  DetectMissingResponseSchema,
  GeneratedDraftResponseSchema,
  IdResponseSchema,
  OkResponseSchema,
  UpdateSectionResponseSchema,
  UpdateSectionChartResponseSchema,
  RewriteSectionResponseSchema,
} from "./_schemas";

export type CreateReportingPeriodResult = Result<{ id: string }, AppError>;

export async function createReportingPeriodAction(input: unknown): Promise<CreateReportingPeriodResult> {
  const context = await requireSession();
  const parsed = CreateReportingPeriodSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) },
    };
  }
  return gatewayRequest("/v1/reporting-periods", IdResponseSchema, context.token, {
    method: "POST",
    body: parsed.data,
  });
}

export type GenerateDraftResult = Result<{ draftId: string; sectionIds: string[] }, AppError>;

export async function generateDraftAction(periodId: string): Promise<GenerateDraftResult> {
  const context = await requireSession();
  return gatewayRequest(`/v1/reporting-periods/${periodId}/generate-draft`, GeneratedDraftResponseSchema, context.token, {
    method: "POST",
    body: {},
    // LLM providers (MiniMax measured at 46-54s) need well beyond the 15s
    // default gateway timeout to draft a full report.
    timeoutMs: 180_000,
  });
}

export type DetectMissingResult = Result<{ created: number }, AppError>;

export async function detectMissingAction(periodId: string): Promise<DetectMissingResult> {
  const context = await requireSession();
  return gatewayRequest(`/v1/reporting-periods/${periodId}/detect-missing`, DetectMissingResponseSchema, context.token, {
    method: "POST",
    body: {},
  });
}

export type UpdateSectionInput = {
  content: string;
  sourceReferences?: Array<{ type: "evidence" | "activity" | "indicator" | "template"; id: string; label?: string }>;
  unsupportedClaims?: string[];
  expectedVersion?: string;
};

export type UpdateSectionResult = Result<{ version: string }, AppError>;

export async function updateReportSectionAction(
  sectionId: string,
  input: UpdateSectionInput,
): Promise<UpdateSectionResult> {
  const context = await requireSession();
  const parsed = UpdateSectionSchema.safeParse({
    content: input.content,
    sourceReferences: input.sourceReferences ?? [],
    unsupportedClaims: input.unsupportedClaims ?? [],
    expectedVersion: input.expectedVersion,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) },
    };
  }
  return gatewayRequest(`/v1/report-sections/${sectionId}`, UpdateSectionResponseSchema, context.token, {
    method: "PUT",
    body: parsed.data,
  });
}

export type ChartConfigInput = {
  type: "BAR" | "LINE" | "PIE" | "AREA" | "RADAR" | "GAUGE";
  dataBinding: "INDICATOR_COMPARISON" | "INDICATOR_ACHIEVEMENT" | "STATUS_DISTRIBUTION";
  options?: Record<string, unknown>;
};

export type UpdateSectionChartResult = Result<{ version: string; chartConfig: ChartConfigInput | null }, AppError>;

export async function updateReportSectionChartAction(
  sectionId: string,
  chartConfig: ChartConfigInput | null,
  expectedVersion?: string,
): Promise<UpdateSectionChartResult> {
  const context = await requireSession();
  return gatewayRequest(`/v1/report-sections/${sectionId}/chart`, UpdateSectionChartResponseSchema, context.token, {
    method: "PATCH",
    body: { chartConfig, expectedVersion },
  });
}

export type SubmitForReviewResult = Result<undefined, AppError>;

export async function submitReportForReviewAction(draftId: string): Promise<SubmitForReviewResult> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/report-drafts/${draftId}/submit-for-review`, OkResponseSchema, context.token, {
    method: "POST",
  });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}

export type ApproveReportResult = Result<undefined, AppError>;

export async function approveReportAction(draftId: string): Promise<ApproveReportResult> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/report-drafts/${draftId}/approve`, OkResponseSchema, context.token, {
    method: "POST",
    body: { decision: "APPROVE" },
  });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}

export type ApproveSectionResult = Result<undefined, AppError>;

export async function approveReportSectionAction(sectionId: string): Promise<ApproveSectionResult> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/report-sections/${sectionId}/approve`, OkResponseSchema, context.token, {
    method: "POST",
  });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}

export type RewriteSectionResult = Result<{ version: string; content: string }, AppError>;

export async function rewriteReportSectionAction(
  sectionId: string,
  input: { mode?: "REWRITE" | "SHORTEN"; audience?: "DONOR" | "INTERNAL" | "GENERAL"; instructions?: string },
): Promise<RewriteSectionResult> {
  const context = await requireSession();
  return gatewayRequest(`/v1/report-sections/${sectionId}/rewrite`, RewriteSectionResponseSchema, context.token, {
    method: "POST",
    body: input,
  });
}
