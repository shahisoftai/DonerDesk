"use server";

import { z } from "zod";
import { BulkReviewActivitiesSchema, ResubmitActivitySchema, CreateActivityUpdateSchema, ReviewActivitySchema, UpdateActivitySchema, AttachEvidenceSchema, DetachEvidenceSchema, ImportActivitiesTextSchema } from "@donordesk/contracts";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { idempotency, type CreateOptions } from "./_idempotency";
import { IdResponseSchema, OkResponseSchema, PolishActivityResponseSchema } from "./_schemas";
import { ImportActivitiesResponseSchema, type ImportActivitiesResponse } from "@/lib/server/schemas";

export type CreateActivityResult = Result<{ id: string }, AppError>;

export type ImportActivitiesResult = Result<ImportActivitiesResponse, AppError>;

/** Auto-parses activity content (Activity Title/Date/Summary/...) and creates records. */
export async function importActivitiesTextAction(input: unknown): Promise<ImportActivitiesResult> {
  const context = await requireSession();
  const parsed = ImportActivitiesTextSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) },
    };
  }
  return gatewayRequest("/v1/activities/import", ImportActivitiesResponseSchema, context.token, {
    method: "POST",
    body: parsed.data,
  });
}

export async function createActivityAction(input: unknown, options: CreateOptions = {}): Promise<CreateActivityResult> {
  const context = await requireSession();
  const parsed = CreateActivityUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) },
    };
  }
  return gatewayRequest("/v1/activities", IdResponseSchema, context.token, {
    method: "POST",
    body: parsed.data,
    ...idempotency(options),
  });
}

export type PolishActivityResult = Result<{ narrative: string; model: string }, AppError>;

export async function polishActivityAction(activityId: string): Promise<PolishActivityResult> {
  const context = await requireSession();
  return gatewayRequest("/v1/activities/polish", PolishActivityResponseSchema, context.token, {
    method: "POST",
    body: { activityId },
  });
}

export type ReviewActivityResult = Result<undefined, AppError>;

export async function reviewActivityAction(input: {
  activityId: string;
  decision: "ACCEPT" | "REVISE" | "REJECT";
  notes?: string;
}): Promise<ReviewActivityResult> {
  const context = await requireSession();
  const parsed = ReviewActivitySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) },
    };
  }
  const result = await gatewayRequest("/v1/activities/review", OkResponseSchema, context.token, {
    method: "POST",
    body: parsed.data,
  });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}

export type UpdateActivityResult = Result<unknown, AppError>;

export async function updateActivityAction(input: unknown): Promise<UpdateActivityResult> {
  const context = await requireSession();
  const parsed = UpdateActivitySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) },
    };
  }
  return gatewayRequest(`/v1/activities/${parsed.data.activityId}`, OkResponseSchema, context.token, {
    method: "PATCH",
    body: parsed.data,
  });
}

export type AttachEvidenceResult = Result<undefined, AppError>;

export async function attachEvidenceAction(input: {
  evidenceId: string;
  activityId?: string;
  indicatorId?: string;
}): Promise<AttachEvidenceResult> {
  const context = await requireSession();
  const parsed = AttachEvidenceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) },
    };
  }
  const result = await gatewayRequest("/v1/activities/attach-evidence", OkResponseSchema, context.token, {
    method: "POST",
    body: parsed.data,
  });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}

export type DetachEvidenceResult = Result<undefined, AppError>;

export async function detachEvidenceAction(input: {
  evidenceId: string;
  activityId?: string;
  indicatorId?: string;
}): Promise<DetachEvidenceResult> {
  const context = await requireSession();
  const parsed = DetachEvidenceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) },
    };
  }
  const result = await gatewayRequest("/v1/activities/detach-evidence", OkResponseSchema, context.token, {
    method: "POST",
    body: parsed.data,
  });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}

const BulkReviewResponseSchema = z.object({
  succeeded: z.number(),
  failed: z.number(),
  results: z.array(z.object({ activityId: z.string(), ok: z.boolean(), error: z.string().optional() })),
});
export type BulkReviewResult = Result<z.infer<typeof BulkReviewResponseSchema>, AppError>;

/** Reviews several records with one decision and one shared note; each record's result comes back separately. */
export async function bulkReviewActivitiesAction(input: { activityIds: string[]; decision: "ACCEPT" | "REVISE" | "REJECT"; notes?: string }): Promise<BulkReviewResult> {
  const context = await requireSession();
  const parsed = BulkReviewActivitiesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { kind: "validation", message: "Choose at least one record to review.", fields: flattenZodFields(parsed.error) } };
  }
  return gatewayRequest("/v1/activities/review-bulk", BulkReviewResponseSchema, context.token, { method: "POST", body: parsed.data, timeoutMs: 60_000 });
}

/** The submitter's answer to a revision request: optional corrections, then back to review. */
export async function resubmitActivityAction(activityId: string, patch: Record<string, string | undefined>): Promise<Result<{ id: string }, AppError>> {
  const context = await requireSession();
  const parsed = ResubmitActivitySchema.safeParse({ activityId, patch });
  if (!parsed.success) {
    return { ok: false, error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) } };
  }
  return gatewayRequest(`/v1/activities/${encodeURIComponent(activityId)}/resubmit`, IdResponseSchema, context.token, { method: "POST", body: { patch: parsed.data.patch } });
}

/** Takes a record out of the reports (replaced by another record, or entered by mistake). */
export async function withdrawActivityAction(activityId: string, supersededById?: string): Promise<Result<{ id: string }, AppError>> {
  const context = await requireSession();
  return gatewayRequest(`/v1/activities/${encodeURIComponent(activityId)}/withdraw`, IdResponseSchema, context.token, { method: "POST", body: supersededById ? { supersededById } : {} });
}

export async function restoreActivityAction(activityId: string): Promise<Result<{ id: string }, AppError>> {
  const context = await requireSession();
  return gatewayRequest(`/v1/activities/${encodeURIComponent(activityId)}/restore`, IdResponseSchema, context.token, { method: "POST", body: {} });
}
