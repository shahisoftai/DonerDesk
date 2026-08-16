"use server";

import { CreateIndicatorSchema, CreateIndicatorUpdateSchema, BulkUpsertIndicatorUpdatesSchema, ParseIndicatorSheetSchema } from "@donordesk/contracts";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { IdResponseSchema, OkResponseSchema } from "./_schemas";
import {
  PeriodIndicatorsResponseSchema,
  ParseIndicatorSheetResponseSchema,
  BulkUpsertResponseSchema,
} from "@/lib/server/schemas";

export type CreateIndicatorResult = Result<{ id: string }, AppError>;

export async function createIndicatorAction(input: unknown): Promise<CreateIndicatorResult> {
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
  return gatewayRequest("/v1/indicators", IdResponseSchema, context.token, {
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

export type BulkSaveRow = {
  indicatorId: string;
  periodAchievement: string;
  cumulativeAchievement: string;
  comments?: string;
  dataSource?: string;
};

export type BulkSaveIndicatorUpdatesResult = Result<{ saved: number; skipped: number }, AppError>;

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
