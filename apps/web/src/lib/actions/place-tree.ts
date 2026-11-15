"use server";

import { AddPlaceInlineSchema, ConfirmPlaceWordSchema, MergePlacesSchema, SetIndicatorPlacesSchema, SetProjectAreaOpenSchema, SetRecordPlacesSchema, TickProjectAreaSchema } from "@donordesk/contracts";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { OkResponseSchema } from "./_schemas";
import {
  ConfirmWordResultSchema, DuplicatePlacesSchema, IndicatorPlaceSettingSchema, IndicatorPlacesSchema, InlinePlaceResultSchema, MergeResultSchema, ProjectPlacesSchema,
  RecordPlacesSchema, SetRecordPlacesResultSchema, TickAreaResultSchema,
  type DuplicatePlacesDto, type IndicatorPlacesDto, type InlinePlaceResult, type ProjectPlacesDto, type RecordPlacesDto,
} from "@/lib/server/schemas-place-tree";

/** Phase 56: a project's footprint, record places, typed words, merges and where an indicator is measured. Every check is repeated by the API. */
const invalid = (error: { issues: unknown[] } & Parameters<typeof flattenZodFields>[0]) => ({
  ok: false as const,
  error: { kind: "validation" as const, message: "Please correct the highlighted fields.", fields: flattenZodFields(error) },
});
const p = (projectId: string) => `/v1/projects/${encodeURIComponent(projectId)}`;
const done = <T,>(r: Result<T, AppError>): Result<undefined, AppError> => (r.ok ? { ok: true, value: undefined } : r);

export async function getProjectPlacesAction(projectId: string): Promise<Result<ProjectPlacesDto, AppError>> {
  const context = await requireSession();
  return gatewayRequest(`${p(projectId)}/places`, ProjectPlacesSchema, context.token);
}

export async function tickProjectAreaAction(projectId: string, input: unknown): Promise<Result<{ placeId: string; replaced: string[] }, AppError>> {
  const context = await requireSession();
  const parsed = TickProjectAreaSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return gatewayRequest(`${p(projectId)}/areas`, TickAreaResultSchema, context.token, { method: "POST", body: parsed.data });
}

export async function untickProjectAreaAction(projectId: string, placeId: string): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  return done(await gatewayRequest(`${p(projectId)}/areas/${encodeURIComponent(placeId)}`, OkResponseSchema, context.token, { method: "DELETE" }));
}

export async function setProjectAreaOpenAction(projectId: string, placeId: string, input: unknown): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const parsed = SetProjectAreaOpenSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return done(await gatewayRequest(`${p(projectId)}/areas/${encodeURIComponent(placeId)}/open`, OkResponseSchema, context.token, { method: "PUT", body: parsed.data }));
}

export async function getRecordPlacesAction(projectId: string, kind: "ACTIVITY" | "EVIDENCE" | "BENEFICIARY", recordId: string): Promise<Result<RecordPlacesDto, AppError>> {
  const context = await requireSession();
  return gatewayRequest(`${p(projectId)}/record-places/${kind}/${encodeURIComponent(recordId)}`, RecordPlacesSchema, context.token);
}

export async function setRecordPlacesAction(projectId: string, kind: "ACTIVITY" | "EVIDENCE" | "BENEFICIARY", recordId: string, input: unknown): Promise<Result<{ outside: string[] }, AppError>> {
  const context = await requireSession();
  const parsed = SetRecordPlacesSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return gatewayRequest(`${p(projectId)}/record-places/${kind}/${encodeURIComponent(recordId)}`, SetRecordPlacesResultSchema, context.token, { method: "PUT", body: parsed.data });
}

export async function confirmPlaceWordAction(projectId: string, input: unknown): Promise<Result<{ linked: number }, AppError>> {
  const context = await requireSession();
  const parsed = ConfirmPlaceWordSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return gatewayRequest(`${p(projectId)}/place-words/confirm`, ConfirmWordResultSchema, context.token, { method: "POST", body: parsed.data });
}

export async function addPlaceInlineAction(projectId: string, input: unknown): Promise<Result<InlinePlaceResult, AppError>> {
  const context = await requireSession();
  const parsed = AddPlaceInlineSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return gatewayRequest(`${p(projectId)}/places/inline`, InlinePlaceResultSchema, context.token, { method: "POST", body: parsed.data });
}

export async function listDuplicatePlacesAction(): Promise<Result<DuplicatePlacesDto, AppError>> {
  const context = await requireSession();
  return gatewayRequest("/v1/places/duplicates", DuplicatePlacesSchema, context.token);
}

export async function mergePlacesAction(input: unknown): Promise<Result<{ moved: number }, AppError>> {
  const context = await requireSession();
  const parsed = MergePlacesSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return gatewayRequest("/v1/places/merge", MergeResultSchema, context.token, { method: "POST", body: parsed.data });
}

export async function getIndicatorPlacesAction(indicatorId: string): Promise<Result<IndicatorPlacesDto, AppError>> {
  const context = await requireSession();
  return gatewayRequest(`/v1/indicators/${encodeURIComponent(indicatorId)}/places`, IndicatorPlacesSchema, context.token);
}

export async function setIndicatorPlacesAction(indicatorId: string, input: unknown): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const parsed = SetIndicatorPlacesSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return done(await gatewayRequest(`/v1/indicators/${encodeURIComponent(indicatorId)}/places`, IndicatorPlaceSettingSchema, context.token, { method: "PUT", body: parsed.data }));
}
