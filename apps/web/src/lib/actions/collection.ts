"use server";

import { ApplyRecordsSchema, CreateCollectionLinkSchema, ReviewRecordSchema, SaveCollectionFormSchema, SubmitRecordSchema } from "@donordesk/contracts";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { IdResponseSchema, OkResponseSchema } from "./_schemas";
import {
  ApplyResultSchema, CollectionLinkCreatedSchema, CollectionLinkListSchema, CollectionRecordListSchema, CollectionTotalsSchema, SubmitResultSchema,
  type CollectionLinkView, type CollectionRecordView, type CollectionTotalsView,
} from "@/lib/server/schemas-collection";
import { z } from "zod";

const invalid = (error: Parameters<typeof flattenZodFields>[0]) => ({
  ok: false as const,
  error: { kind: "validation" as const, message: "Please correct the highlighted fields.", fields: flattenZodFields(error) },
});
const enc = encodeURIComponent;

export async function saveCollectionFormAction(input: unknown, formId?: string): Promise<Result<{ id: string }, AppError>> {
  const context = await requireSession();
  const parsed = SaveCollectionFormSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return gatewayRequest(formId ? `/v1/collection-forms/${enc(formId)}` : "/v1/collection-forms", IdResponseSchema, context.token, { method: formId ? "PUT" : "POST", body: parsed.data });
}

export async function setCollectionFormStatusAction(formId: string, to: "publish" | "close"): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/collection-forms/${enc(formId)}/${to}`, OkResponseSchema, context.token, { method: "POST", body: {} });
  return result.ok ? { ok: true, value: undefined } : result;
}

export async function submitCollectionRecordAction(formId: string, input: unknown): Promise<Result<{ id: string; duplicate: boolean; ignored?: string[] | undefined }, AppError>> {
  const context = await requireSession();
  const parsed = SubmitRecordSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return gatewayRequest(`/v1/collection-forms/${enc(formId)}/records`, SubmitResultSchema, context.token, { method: "POST", body: parsed.data });
}

export async function listCollectionRecordsAction(formId: string, status?: "PENDING" | "ACCEPTED" | "REJECTED"): Promise<Result<CollectionRecordView[], AppError>> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/collection-forms/${enc(formId)}/records${status ? `?status=${status}` : ""}`, CollectionRecordListSchema, context.token);
  return result.ok ? { ok: true, value: result.value.records } : result;
}

export async function reviewCollectionRecordAction(recordId: string, input: unknown): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const parsed = ReviewRecordSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const result = await gatewayRequest(`/v1/collection-records/${enc(recordId)}/review`, OkResponseSchema, context.token, { method: "POST", body: parsed.data });
  return result.ok ? { ok: true, value: undefined } : result;
}

export async function getCollectionTotalsAction(formId: string): Promise<Result<CollectionTotalsView, AppError>> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/collection-forms/${enc(formId)}/totals`, CollectionTotalsSchema, context.token);
  return result.ok ? { ok: true, value: result.value.totals } : result;
}

export async function applyCollectionTotalsAction(formId: string, input: unknown): Promise<Result<z.infer<typeof ApplyResultSchema>, AppError>> {
  const context = await requireSession();
  const parsed = ApplyRecordsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return gatewayRequest(`/v1/collection-forms/${enc(formId)}/apply`, ApplyResultSchema, context.token, { method: "POST", body: parsed.data });
}

export async function listCollectionLinksAction(formId: string): Promise<Result<CollectionLinkView[], AppError>> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/collection-forms/${enc(formId)}/links`, CollectionLinkListSchema, context.token);
  return result.ok ? { ok: true, value: result.value.links } : result;
}

/** The token is in the answer once; the page shows it as a link and never stores it. */
export async function createCollectionLinkAction(formId: string, input: unknown): Promise<Result<z.infer<typeof CollectionLinkCreatedSchema>, AppError>> {
  const context = await requireSession();
  const parsed = CreateCollectionLinkSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return gatewayRequest(`/v1/collection-forms/${enc(formId)}/links`, CollectionLinkCreatedSchema, context.token, { method: "POST", body: parsed.data });
}

export async function revokeCollectionLinkAction(linkId: string): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/collection-links/${enc(linkId)}/revoke`, OkResponseSchema, context.token, { method: "POST", body: {} });
  return result.ok ? { ok: true, value: undefined } : result;
}
