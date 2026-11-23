"use server";

import { AssignFacilitiesSchema, CorrectiveActionSchema, MoveAssignmentSchema, SaveDraftSchema, ApplyKitSchema } from "@donordesk/contracts";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { OkResponseSchema } from "./_schemas";
import {
  ActionResultSchema, AssignResultSchema, ComparisonSchema, DraftEnvelopeSchema, DraftSchema, FormAssignmentsSchema, KitAppliedSchema, KitListSchema, MyAssignmentsSchema, MyDraftListSchema, PrefillSchema, ProposalSchema, ScoreSchema,
  type AssignmentView, type ComparisonView, type DraftView, type FormAssignmentsView, type KitView, type MyDraftView, type PrefillView, type ProposalView, type ScoreView,
} from "@/lib/server/schemas-assessments";
import { ProjectPeopleResponseSchema } from "@/lib/server/schemas";
import { z } from "zod";

const invalid = (error: Parameters<typeof flattenZodFields>[0]) => ({
  ok: false as const,
  error: { kind: "validation" as const, message: "Please correct the highlighted fields.", fields: flattenZodFields(error) },
});
const enc = encodeURIComponent;
const withPlace = (placeId?: string) => (placeId ? `?placeId=${enc(placeId)}` : "");

/** The person's own draft of a form for a facility (or none). */
export async function getCollectionDraftAction(formId: string, placeId?: string): Promise<Result<DraftView | null, AppError>> {
  const context = await requireSession();
  const r = await gatewayRequest(`/v1/collection-forms/${enc(formId)}/draft${withPlace(placeId)}`, DraftEnvelopeSchema, context.token);
  return r.ok ? { ok: true, value: r.value.draft } : r;
}

export async function saveCollectionDraftAction(formId: string, input: unknown): Promise<Result<DraftView, AppError>> {
  const context = await requireSession();
  const parsed = SaveDraftSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return gatewayRequest(`/v1/collection-forms/${enc(formId)}/draft`, DraftSchema, context.token, { method: "PUT", body: parsed.data });
}

export async function discardCollectionDraftAction(formId: string, placeId?: string): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const r = await gatewayRequest(`/v1/collection-forms/${enc(formId)}/draft${withPlace(placeId)}`, OkResponseSchema, context.token, { method: "DELETE" });
  return r.ok ? { ok: true, value: undefined } : r;
}

export async function listMyCollectionDraftsAction(): Promise<Result<MyDraftView[], AppError>> {
  const context = await requireSession();
  const r = await gatewayRequest("/v1/me/collection-drafts", MyDraftListSchema, context.token);
  return r.ok ? { ok: true, value: r.value.drafts } : r;
}

export async function listMyFacilityAssignmentsAction(): Promise<Result<AssignmentView[], AppError>> {
  const context = await requireSession();
  const r = await gatewayRequest("/v1/me/facility-assignments", MyAssignmentsSchema, context.token);
  return r.ok ? { ok: true, value: r.value.assignments } : r;
}

export async function listFormAssignmentsAction(formId: string, level?: number): Promise<Result<FormAssignmentsView, AppError>> {
  const context = await requireSession();
  return gatewayRequest(`/v1/collection-forms/${enc(formId)}/assignments${level !== undefined ? `?level=${level}` : ""}`, FormAssignmentsSchema, context.token);
}

export async function assignFacilitiesAction(formId: string, input: unknown): Promise<Result<z.infer<typeof AssignResultSchema>, AppError>> {
  const context = await requireSession();
  const parsed = AssignFacilitiesSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return gatewayRequest(`/v1/collection-forms/${enc(formId)}/assignments`, AssignResultSchema, context.token, { method: "POST", body: parsed.data });
}

export async function moveFacilityAssignmentAction(assignmentId: string, input: unknown): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const parsed = MoveAssignmentSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const r = await gatewayRequest(`/v1/collection-assignments/${enc(assignmentId)}/move`, OkResponseSchema, context.token, { method: "POST", body: parsed.data });
  return r.ok ? { ok: true, value: undefined } : r;
}

export async function getAssessmentPrefillAction(formId: string, placeId: string): Promise<Result<PrefillView, AppError>> {
  const context = await requireSession();
  return gatewayRequest(`/v1/collection-forms/${enc(formId)}/prefill?placeId=${enc(placeId)}`, PrefillSchema, context.token);
}

export async function getRecordScoreAction(recordId: string): Promise<Result<ScoreView, AppError>> {
  const context = await requireSession();
  return gatewayRequest(`/v1/collection-records/${enc(recordId)}/score`, ScoreSchema, context.token);
}

export async function compareVisitsAction(recordId: string, againstId?: string): Promise<Result<ComparisonView, AppError>> {
  const context = await requireSession();
  return gatewayRequest(`/v1/collection-records/${enc(recordId)}/compare${againstId ? `?against=${enc(againstId)}` : ""}`, ComparisonSchema, context.token);
}

/** From a low item to a request or a problem: one click, always a person's choice. */
export async function createCorrectiveActionAction(recordId: string, input: unknown): Promise<Result<z.infer<typeof ActionResultSchema>, AppError>> {
  const context = await requireSession();
  const parsed = CorrectiveActionSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return gatewayRequest(`/v1/collection-records/${enc(recordId)}/actions`, ActionResultSchema, context.token, { method: "POST", body: parsed.data });
}

export async function listFormKitsAction(): Promise<Result<KitView[], AppError>> {
  const context = await requireSession();
  const r = await gatewayRequest("/v1/form-kits", KitListSchema, context.token);
  return r.ok ? { ok: true, value: r.value.kits } : r;
}

export async function applyFormKitAction(input: unknown): Promise<Result<z.infer<typeof KitAppliedSchema>, AppError>> {
  const context = await requireSession();
  const parsed = ApplyKitSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return gatewayRequest("/v1/form-kits/apply", KitAppliedSchema, context.token, { method: "POST", body: parsed.data });
}

/** Reads a Word or Excel tool into a proposed form. Sends the file as multipart; nothing is saved. */
export async function proposeFormFromFileAction(formData: FormData): Promise<Result<ProposalView, AppError>> {
  const context = await requireSession();
  return gatewayRequest("/v1/collection-forms/propose", ProposalSchema, context.token, { method: "POST", formData, timeoutMs: 90_000 });
}

/** The active members of a project, for choosing who gets which facilities. */
export async function listAssessorsAction(projectId: string): Promise<Result<Array<{ userId: string; name: string; role: string }>, AppError>> {
  const context = await requireSession();
  const r = await gatewayRequest(`/v1/projects/${enc(projectId)}/people`, ProjectPeopleResponseSchema, context.token);
  return r.ok ? { ok: true, value: r.value.items } : r;
}
