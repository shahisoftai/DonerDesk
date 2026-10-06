"use server";

import { UpdateIndicatorSchema, MoveIndicatorSchema, CreateIndicatorSchema, CreateIndicatorUpdateSchema, BulkUpsertIndicatorUpdatesSchema, ParseIndicatorSheetSchema, ImportIndicatorsTextSchema, IndicatorUpdateReviewReasonSchema } from "@donordesk/contracts";
import type { UpsertIndicatorUpdateInput } from "@donordesk/contracts";
import { z } from "zod";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { idempotency, type CreateOptions } from "./_idempotency";
import { IdResponseSchema, OkResponseSchema } from "./_schemas";
import {
  PeriodIndicatorsResponseSchema,
  ParseIndicatorSheetResponseSchema,
  BulkUpsertResponseSchema,
  CreateIndicatorResponseSchema,
  ConfirmSemanticsResponseSchema,
  VerifyAllResponseSchema,
  ImportIndicatorsResponseSchema,
  type ImportIndicatorsResponse,
} from "@/lib/server/schemas";

export type CreateIndicatorResult = Result<import("zod").infer<typeof CreateIndicatorResponseSchema>, AppError>;

export async function createIndicatorAction(input: unknown, options: CreateOptions = {}): Promise<CreateIndicatorResult> {
  const context = await requireSession();
  const parsed = CreateIndicatorSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        kind: "validation",
        message: "Please correct the highlighted fields.",
        fields: flattenZodFields(parsed.error),
      },
    };
  }
  return gatewayRequest("/v1/indicators", CreateIndicatorResponseSchema, context.token, {
    method: "POST",
    body: parsed.data,
    ...idempotency(options),
  });
}

export type ImportIndicatorsResult = Result<ImportIndicatorsResponse, AppError>;

/** Auto-parses indicator content (Code/Name/Type/Baseline/Target) and creates records. */
export async function importIndicatorsTextAction(input: unknown): Promise<ImportIndicatorsResult> {
  const context = await requireSession();
  const parsed = ImportIndicatorsTextSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        kind: "validation",
        message: "Please correct the highlighted fields.",
        fields: flattenZodFields(parsed.error),
      },
    };
  }
  return gatewayRequest("/v1/logframe/indicators/import", ImportIndicatorsResponseSchema, context.token, {
    method: "POST",
    body: parsed.data,
  });
}

export async function createIndicatorUpdateAction(input: unknown): Promise<Result<{ id: string }, AppError>> {
  const context = await requireSession();
  const parsed = CreateIndicatorUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        kind: "validation",
        message: "Please correct the highlighted fields.",
        fields: flattenZodFields(parsed.error),
      },
    };
  }
  return gatewayRequest("/v1/indicator-updates", IdResponseSchema, context.token, {
    method: "POST",
    body: parsed.data,
  });
}

export type BulkSaveRow = UpsertIndicatorUpdateInput;

export type BulkSaveIndicatorUpdatesResult = Result<import("zod").infer<typeof BulkUpsertResponseSchema>, AppError>;

export async function bulkSaveIndicatorUpdatesAction(
  reportingPeriodId: string,
  rows: BulkSaveRow[],
): Promise<BulkSaveIndicatorUpdatesResult> {
  const context = await requireSession();
  const parsed = BulkUpsertIndicatorUpdatesSchema.safeParse({ reportingPeriodId, updates: rows });
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        kind: "validation",
        message: "Please correct the highlighted fields.",
        fields: flattenZodFields(parsed.error),
      },
    };
  }
  return gatewayRequest("/v1/indicator-updates/bulk", BulkUpsertResponseSchema, context.token, {
    method: "POST",
    body: parsed.data,
  });
}

export type LoadPeriodIndicatorsResult = Result<
  { periodId: string; projectId: string; indicators: import("@/lib/server/schemas").PeriodIndicatorRow[] },
  AppError
>;

export async function loadPeriodIndicatorsAction(reportingPeriodId: string): Promise<LoadPeriodIndicatorsResult> {
  const context = await requireSession();
  return gatewayRequest(`/v1/reporting-periods/${reportingPeriodId}/indicators`, PeriodIndicatorsResponseSchema, context.token);
}

export type ParseIndicatorSheetResult = Result<
  { rows: Array<{ indicatorId: string | null; code: string; name: string | null; periodAchievement: string; cumulativeAchievement: string; comments: string; dataSource: string; matched: boolean }>; warnings: string[] },
  AppError
>;

export async function parseIndicatorSheetAction(reportingPeriodId: string, sheetUrl: string): Promise<ParseIndicatorSheetResult> {
  const context = await requireSession();
  const parsed = ParseIndicatorSheetSchema.safeParse({ reportingPeriodId, sheetUrl });
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        kind: "validation",
        message: "Please correct the highlighted fields.",
        fields: flattenZodFields(parsed.error),
      },
    };
  }
  return gatewayRequest("/v1/indicator-updates/parse-sheet", ParseIndicatorSheetResponseSchema, context.token, {
    method: "POST",
    body: parsed.data,
  });
}

export async function verifyIndicatorUpdateAction(id: string): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/indicator-updates/${id}/verify`, OkResponseSchema, context.token, {
    method: "POST",
  });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}

export type IndicatorUpdateReviewDecision = "request-correction" | "reject";

export async function reviewIndicatorUpdateAction(
  id: string,
  decision: IndicatorUpdateReviewDecision,
  input: unknown,
): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const parsed = IndicatorUpdateReviewReasonSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "validation", message: "A reason is required.", fields: flattenZodFields(parsed.error) },
    };
  }
  const result = await gatewayRequest(`/v1/indicator-updates/${encodeURIComponent(id)}/${decision}`, OkResponseSchema, context.token, {
    method: "POST",
    body: parsed.data,
  });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}

export type ConfirmSemanticsResult = Result<import("zod").infer<typeof ConfirmSemanticsResponseSchema>, AppError>;

/** One-click "this calculation is right" for one or more indicators. */
export async function confirmIndicatorSemanticsAction(indicatorIds: string[]): Promise<ConfirmSemanticsResult> {
  const context = await requireSession();
  if (indicatorIds.length === 0) {
    return { ok: false, error: { kind: "validation", message: "Choose at least one indicator.", fields: {} } };
  }
  return gatewayRequest("/v1/indicators/semantics/confirm", ConfirmSemanticsResponseSchema, context.token, {
    method: "POST",
    body: { indicatorIds },
  });
}

export type VerifyAllResult = Result<import("zod").infer<typeof VerifyAllResponseSchema>, AppError>;

/** Verifies every unverified indicator value of a period (or just the given updates). */
export async function verifyAllIndicatorUpdatesAction(reportingPeriodId: string, updateIds?: string[]): Promise<VerifyAllResult> {
  const context = await requireSession();
  return gatewayRequest(`/v1/reporting-periods/${encodeURIComponent(reportingPeriodId)}/indicator-updates/verify-all`, VerifyAllResponseSchema, context.token, {
    method: "POST",
    body: updateIds ? { updateIds } : {},
  });
}

const IndicatorMovedResponseSchema = z.object({ id: z.string(), moved: z.boolean() });
const IndicatorRemovedResponseSchema = z.object({ outcome: z.enum(["ARCHIVED", "DELETED"]) });

function validationFailure(error: import("zod").ZodError): { ok: false; error: AppError } {
  return { ok: false, error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(error) } };
}

/** Edits an indicator's own fields; only the fields sent change. */
export async function updateIndicatorAction(input: unknown): Promise<Result<{ id: string }, AppError>> {
  const context = await requireSession();
  const parsed = UpdateIndicatorSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  const { indicatorId, ...body } = parsed.data;
  return gatewayRequest(`/v1/indicators/${encodeURIComponent(indicatorId)}`, IdResponseSchema, context.token, { method: "PATCH", body });
}

/** Moves an indicator under another logframe item of the same project. */
export async function moveIndicatorAction(input: unknown): Promise<Result<{ id: string; moved: boolean }, AppError>> {
  const context = await requireSession();
  const parsed = MoveIndicatorSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);
  return gatewayRequest(`/v1/indicators/${encodeURIComponent(parsed.data.indicatorId)}/move`, IndicatorMovedResponseSchema, context.token, {
    method: "POST",
    body: { logframeItemId: parsed.data.logframeItemId },
  });
}

/** Deletes an indicator nothing was recorded for, otherwise archives it (its values are kept). */
export async function archiveIndicatorAction(indicatorId: string): Promise<Result<{ outcome: "ARCHIVED" | "DELETED" }, AppError>> {
  const context = await requireSession();
  return gatewayRequest(`/v1/indicators/${encodeURIComponent(indicatorId)}/archive`, IndicatorRemovedResponseSchema, context.token, { method: "POST", body: {} });
}

export async function restoreIndicatorAction(indicatorId: string): Promise<Result<{ id: string }, AppError>> {
  const context = await requireSession();
  return gatewayRequest(`/v1/indicators/${encodeURIComponent(indicatorId)}/restore`, IdResponseSchema, context.token, { method: "POST", body: {} });
}
