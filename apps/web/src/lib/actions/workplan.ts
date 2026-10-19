"use server";

import { UpdatePlannedActivitySchema, ImportWorkPlanSchema, AssignPlannedActivitySchema, ChangePlanStatusSchema, CreatePlannedActivitySchema, ReschedulePlannedActivitySchema, StartPlanFromLogframeSchema, AddPlanDependencySchema, DefineProjectFieldSchema, SetPlanItemFieldsSchema, AddBudgetLineSchema, AddBudgetExpenseSchema, BulkPlanActionSchema, SetCapacitySchema, SetAutomationRuleSchema, RegisterBeneficiarySchema, ImportSubmissionsSchema, ImportSubmissionsWithMappingSchema, SubmissionMappingSchema, SetPlanIndicatorsSchema, SaveProgressSchema, CompletePlannedActivitySchema, ChangeActivityPeopleSchema } from "@donordesk/contracts";
import type { ZodType } from "zod";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { idempotency, type CreateOptions } from "./_idempotency";
import { z } from "zod";
import { OkResponseSchema } from "./_schemas";
import { SubmissionReviewSchema, type SubmissionReview, SubmissionMappingResponseSchema, BulkPlanResultSchema, CreatedPlannedActivitiesSchema, ImportWorkPlanResponseSchema, PlanPreviewSchema, type BulkPlanResult, type ImportWorkPlanResponse, type PlanPreviewResponse } from "@/lib/server/schemas";

const MovedResponseSchema = z.object({
  moved: z.number(),
  movedByDependency: z.array(z.object({ id: z.string(), title: z.string(), plannedStart: z.string(), plannedEnd: z.string() })).default([]),
  blockedByDependency: z.array(z.object({ id: z.string(), title: z.string(), reason: z.enum(["DONE", "CANCELLED"]) })).default([]),
});
const DependencyCreatedSchema = z.object({ id: z.string() });

/** What a move pushed along, and what it could not move because the activity was already done or cancelled. */
export interface RescheduleOutcomeView {
  movedByDependency: Array<{ title: string }>;
  blockedByDependency: Array<{ title: string; reason: "DONE" | "CANCELLED" }>;
}

function invalid<T>(error: import("zod").ZodError): Result<T, AppError> {
  return { ok: false, error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(error) } };
}

async function parsed<T>(schema: ZodType<T>, input: unknown): Promise<{ ok: true; data: T } | { ok: false; result: Result<never, AppError> }> {
  const r = schema.safeParse(input);
  return r.success ? { ok: true, data: r.data } : { ok: false, result: invalid(r.error) };
}

export async function createPlannedActivityAction(projectId: string, input: unknown, options: CreateOptions = {}): Promise<Result<{ ids: string[]; capped: boolean }, AppError>> {
  const context = await requireSession();
  const p = await parsed(CreatePlannedActivitySchema, input);
  if (!p.ok) return p.result;
  return gatewayRequest(`/v1/projects/${projectId}/work-plan`, CreatedPlannedActivitiesSchema, context.token, { method: "POST", body: p.data, ...idempotency(options) });
}

export async function changePlanStatusAction(itemId: string, input: unknown): Promise<Result<true, AppError>> {
  const context = await requireSession();
  const p = await parsed(ChangePlanStatusSchema, input);
  if (!p.ok) return p.result;
  const r = await gatewayRequest(`/v1/work-plan/${itemId}/status`, OkResponseSchema, context.token, { method: "POST", body: p.data });
  return r.ok ? { ok: true, value: true } : r;
}

export async function reschedulePlannedActivityAction(itemId: string, input: unknown): Promise<Result<RescheduleOutcomeView, AppError>> {
  const context = await requireSession();
  const p = await parsed(ReschedulePlannedActivitySchema, input);
  if (!p.ok) return p.result;
  const r = await gatewayRequest(`/v1/work-plan/${itemId}/reschedule`, MovedResponseSchema, context.token, { method: "POST", body: p.data });
  if (!r.ok) return r;
  return { ok: true, value: { movedByDependency: r.value.movedByDependency, blockedByDependency: r.value.blockedByDependency } };
}

/** "B comes after A". The server refuses a loop, a duplicate, a self link or another project. */
export async function addPlanDependencyAction(predecessorId: string, successorId: string): Promise<Result<true, AppError>> {
  const context = await requireSession();
  const p = await parsed(AddPlanDependencySchema, { predecessorId, successorId });
  if (!p.ok) return p.result;
  const r = await gatewayRequest("/v1/work-plan/dependencies", DependencyCreatedSchema, context.token, { method: "POST", body: p.data });
  return r.ok ? { ok: true, value: true } : r;
}

export async function removePlanDependencyAction(predecessorId: string, successorId: string): Promise<Result<true, AppError>> {
  const context = await requireSession();
  const r = await gatewayRequest(`/v1/work-plan/dependencies/${encodeURIComponent(predecessorId)}/${encodeURIComponent(successorId)}`, OkResponseSchema, context.token, { method: "DELETE" });
  return r.ok ? { ok: true, value: true } : r;
}

export async function assignPlannedActivityAction(itemId: string, input: unknown): Promise<Result<true, AppError>> {
  const context = await requireSession();
  const p = await parsed(AssignPlannedActivitySchema, input);
  if (!p.ok) return p.result;
  const r = await gatewayRequest(`/v1/work-plan/${itemId}/assign`, OkResponseSchema, context.token, { method: "POST", body: p.data });
  return r.ok ? { ok: true, value: true } : r;
}

/** `apply: false` previews (nothing saved); `apply: true` creates the plan. */
export async function startPlanFromLogframeAction(projectId: string, input: unknown, options: CreateOptions = {}): Promise<Result<PlanPreviewResponse, AppError>> {
  const context = await requireSession();
  const p = await parsed(StartPlanFromLogframeSchema, input);
  if (!p.ok) return p.result;
  return gatewayRequest(`/v1/projects/${projectId}/work-plan/from-logframe`, PlanPreviewSchema, context.token, { method: "POST", body: p.data, ...(p.data.apply ? idempotency(options) : {}) });
}

export async function setWorkPlanningVisibilityAction(projectId: string, show: boolean): Promise<Result<true, AppError>> {
  const context = await requireSession();
  const r = await gatewayRequest(`/v1/projects/${projectId}/work-planning`, OkResponseSchema, context.token, { method: "PUT", body: { show } });
  return r.ok ? { ok: true, value: true } : r;
}

/** Imports a work plan from text. Any row that cannot be read stops the whole import; the message names the rows. */
export async function importWorkPlanAction(projectId: string, input: unknown): Promise<Result<ImportWorkPlanResponse, AppError>> {
  const context = await requireSession();
  const p = await parsed(ImportWorkPlanSchema, input);
  if (!p.ok) return p.result;
  return gatewayRequest(`/v1/projects/${projectId}/work-plan/import`, ImportWorkPlanResponseSchema, context.token, { method: "POST", body: p.data });
}

/** Edits a planned activity (title, notes, place, targets, the files we will need). Whether the person may is the server's call. */
export async function updatePlannedActivityAction(itemId: string, input: unknown): Promise<Result<true, AppError>> {
  const context = await requireSession();
  const p = await parsed(UpdatePlannedActivitySchema, input);
  if (!p.ok) return p.result;
  const r = await gatewayRequest(`/v1/work-plan/${itemId}`, OkResponseSchema, context.token, { method: "PUT", body: p.data });
  return r.ok ? { ok: true, value: true } : r;
}

const FieldCreatedSchema = z.object({ id: z.string() });

/** A custom field for the project's planned activities (managers only; the server checks). */
export async function defineProjectFieldAction(projectId: string, input: unknown): Promise<Result<{ id: string }, AppError>> {
  const context = await requireSession();
  const p = await parsed(DefineProjectFieldSchema, input);
  if (!p.ok) return p.result;
  return gatewayRequest(`/v1/projects/${encodeURIComponent(projectId)}/plan-fields`, FieldCreatedSchema, context.token, { method: "POST", body: p.data });
}

/** Values for a planned activity's fields. A blank value is sent as null, so it clears the stored one. */
export async function setPlanItemFieldsAction(itemId: string, input: unknown): Promise<Result<true, AppError>> {
  const context = await requireSession();
  const p = await parsed(SetPlanItemFieldsSchema, input);
  if (!p.ok) return p.result;
  const r = await gatewayRequest(`/v1/work-plan/${itemId}/fields`, OkResponseSchema, context.token, { method: "PUT", body: p.data });
  return r.ok ? { ok: true, value: true } : r;
}

const IdCreatedSchema = z.object({ id: z.string() });

/** A budget line on the activity (managers only; the amount is checked on the server). */
export async function addBudgetLineAction(itemId: string, input: unknown): Promise<Result<{ id: string }, AppError>> {
  const context = await requireSession();
  const p = await parsed(AddBudgetLineSchema, input);
  if (!p.ok) return p.result;
  return gatewayRequest(`/v1/work-plan/${encodeURIComponent(itemId)}/budget-lines`, IdCreatedSchema, context.token, { method: "POST", body: p.data });
}

/** An expense against one of the activity's lines. */
export async function addBudgetExpenseAction(itemId: string, lineId: string, input: unknown): Promise<Result<{ id: string }, AppError>> {
  const context = await requireSession();
  const p = await parsed(AddBudgetExpenseSchema, input);
  if (!p.ok) return p.result;
  return gatewayRequest(`/v1/work-plan/${encodeURIComponent(itemId)}/budget-lines/${encodeURIComponent(lineId)}/expenses`, IdCreatedSchema, context.token, { method: "POST", body: p.data });
}

/** Previews (apply false) or applies a change to many activities. Nothing is saved on a preview. */
export async function bulkPlanAction(projectId: string, input: unknown): Promise<Result<BulkPlanResult, AppError>> {
  const context = await requireSession();
  const p = await parsed(BulkPlanActionSchema, input);
  if (!p.ok) return p.result;
  return gatewayRequest(`/v1/projects/${encodeURIComponent(projectId)}/work-plan/bulk`, BulkPlanResultSchema, context.token, { method: "POST", body: p.data });
}

/** A person's weekly limit in activities; blank clears it. Managers only (the server checks). */
export async function setCapacityAction(userId: string, activitiesPerWeek: number | null): Promise<Result<true, AppError>> {
  const context = await requireSession();
  const p = await parsed(SetCapacitySchema, { activitiesPerWeek });
  if (!p.ok) return p.result;
  const r = await gatewayRequest(`/v1/users/${encodeURIComponent(userId)}/capacity`, OkResponseSchema, context.token, { method: "PUT", body: p.data });
  return r.ok ? { ok: true, value: true } : r;
}

/** Switches one automation rule on or off for a project. Managers only (the server checks). */
export async function setAutomationRuleAction(projectId: string, ruleKey: string, enabled: boolean): Promise<Result<true, AppError>> {
  const context = await requireSession();
  const p = await parsed(SetAutomationRuleSchema, { enabled });
  if (!p.ok) return p.result;
  const r = await gatewayRequest(`/v1/projects/${encodeURIComponent(projectId)}/automations/${encodeURIComponent(ruleKey)}`, OkResponseSchema, context.token, { method: "PUT", body: p.data });
  return r.ok ? { ok: true, value: true } : r;
}

const BeneficiaryCreatedSchema = z.object({ id: z.string(), probableDuplicates: z.array(z.string()) });

/** Adds one person by case code, with consent recorded. Returns the case codes that look like the same person, for a decision. */
export async function registerBeneficiaryAction(projectId: string, input: unknown): Promise<Result<{ id: string; probableDuplicates: string[] }, AppError>> {
  const context = await requireSession();
  const p = await parsed(RegisterBeneficiarySchema, input);
  if (!p.ok) return p.result;
  return gatewayRequest(`/v1/projects/${encodeURIComponent(projectId)}/beneficiaries`, BeneficiaryCreatedSchema, context.token, { method: "POST", body: p.data });
}

const ImportedSchema = z.object({ added: z.number() });

/** Adds the people in a KoboToolbox or ODK export (CSV text). Refused as a whole when any row is wrong. */
export async function importSubmissionsAction(projectId: string, csv: string, mapping?: Record<string, string>): Promise<Result<{ added: number }, AppError>> {
  const context = await requireSession();
  const p = await parsed(ImportSubmissionsWithMappingSchema, { csv, ...(mapping ? { mapping } : {}) });
  if (!p.ok) return p.result;
  return gatewayRequest(`/v1/projects/${encodeURIComponent(projectId)}/beneficiaries/import`, ImportedSchema, context.token, { method: "POST", body: p.data });
}

/** Which indicators the activity reports on. Their breakdowns become the fields of its progress log. */
export async function setPlanIndicatorsAction(itemId: string, indicatorIds: string[]): Promise<Result<true, AppError>> {
  const context = await requireSession();
  const p = await parsed(SetPlanIndicatorsSchema, { indicatorIds });
  if (!p.ok) return p.result;
  const r = await gatewayRequest(`/v1/work-plan/${encodeURIComponent(itemId)}/indicators`, OkResponseSchema, context.token, { method: "PUT", body: p.data });
  return r.ok ? { ok: true, value: true } : r;
}

const ProgressSavedSchema = z.object({ id: z.string(), absorbed: z.number() });

/** Saves one progress entry (day, week, month or activity end). Blank figures are sent blank. */
export async function saveProgressAction(itemId: string, input: unknown): Promise<Result<{ id: string; absorbed: number }, AppError>> {
  const context = await requireSession();
  const p = await parsed(SaveProgressSchema, input);
  if (!p.ok) return p.result;
  return gatewayRequest(`/v1/work-plan/${encodeURIComponent(itemId)}/progress`, ProgressSavedSchema, context.token, { method: "POST", body: p.data });
}

/** Removes a progress entry; a monthly report's removal gives back the entries it had absorbed. */
export async function removeProgressAction(itemId: string, entryId: string): Promise<Result<true, AppError>> {
  const context = await requireSession();
  const r = await gatewayRequest(`/v1/work-plan/${encodeURIComponent(itemId)}/progress/${encodeURIComponent(entryId)}`, OkResponseSchema, context.token, { method: "DELETE" });
  return r.ok ? { ok: true, value: true } : r;
}

/** Marks a planned activity done in one step: records the completed activity and sets the plan status. Refusals change nothing. */
export async function completePlannedActivityAction(itemId: string, input: unknown): Promise<Result<{ activityId: string }, AppError>> {
  const context = await requireSession();
  const p = await parsed(CompletePlannedActivitySchema, input);
  if (!p.ok) return p.result;
  return gatewayRequest(`/v1/work-plan/${encodeURIComponent(itemId)}/complete`, z.object({ activityId: z.string() }), context.token, { method: "POST", body: p.data });
}

/** The column mapping saved for this project's imports, or none. */
export async function getSubmissionMappingAction(projectId: string): Promise<Result<{ mapping: Record<string, string> | null }, AppError>> {
  const context = await requireSession();
  return gatewayRequest(`/v1/projects/${encodeURIComponent(projectId)}/submission-mapping`, SubmissionMappingResponseSchema, context.token);
}

/** Saves the column mapping for this project's imports. Managers only. */
export async function saveSubmissionMappingAction(projectId: string, mapping: Record<string, string>): Promise<Result<true, AppError>> {
  const context = await requireSession();
  const p = await parsed(SubmissionMappingSchema, mapping);
  if (!p.ok) return p.result;
  const r = await gatewayRequest(`/v1/projects/${encodeURIComponent(projectId)}/submission-mapping`, OkResponseSchema, context.token, { method: "PUT", body: p.data });
  return r.ok ? { ok: true, value: true } : r;
}

const ActivityPeopleChangedSchema = z.object({ added: z.number(), removed: z.number(), unknown: z.array(z.string()) });

/** Adds people to an activity by pasted case codes, or removes them. A code not in the project is reported back. */
export async function changeActivityPeopleAction(itemId: string, input: unknown): Promise<Result<{ added: number; removed: number; unknown: string[] }, AppError>> {
  const context = await requireSession();
  const p = await parsed(ChangeActivityPeopleSchema, input);
  if (!p.ok) return p.result;
  return gatewayRequest(`/v1/work-plan/${encodeURIComponent(itemId)}/people`, ActivityPeopleChangedSchema, context.token, { method: "PUT", body: p.data });
}


/** Reads a file and says what an import would do, without saving anything. */
export async function previewSubmissionsAction(projectId: string, csv: string, mapping?: Record<string, string>): Promise<Result<SubmissionReview, AppError>> {
  const context = await requireSession();
  const p = await parsed(ImportSubmissionsWithMappingSchema, { csv, ...(mapping ? { mapping } : {}) });
  if (!p.ok) return p.result;
  return gatewayRequest(`/v1/projects/${encodeURIComponent(projectId)}/beneficiaries/import/preview`, SubmissionReviewSchema, context.token, { method: "POST", body: p.data });
}
