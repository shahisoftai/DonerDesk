"use server";

import { UpdateTemplateMappingSchema, LockTemplateMappingSchema, type RegionUpdate } from "@donordesk/contracts";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { DetectTemplateRegionsResponseSchema, DonorTemplateMappingDtoSchema } from "@/lib/server/schemas";
import { OkResponseSchema } from "./_schemas";
import { z } from "zod";

export type DetectTemplateMappingResult = Result<z.infer<typeof DetectTemplateRegionsResponseSchema>, AppError>;

/**
 * Step 1 of the donor-template mapping flow: parses the uploaded DOCX for
 * structural regions (headings/tables) and auto-maps each to a DonorDesk
 * report section, persisting a new DRAFT mapping version. Safe to re-run.
 */
export async function detectTemplateMappingAction(templateId: string, file: File): Promise<DetectTemplateMappingResult> {
  const context = await requireSession();
  if (!file || file.size === 0) {
    return { ok: false, error: { kind: "validation", message: "Please select the donor template DOCX file.", fields: {} } };
  }
  const formData = new FormData();
  formData.set("file", file);
  return gatewayRequest(`/v1/templates/${templateId}/mappings/detect`, DetectTemplateRegionsResponseSchema, context.token, {
    method: "POST",
    formData,
  });
}

export type GetTemplateMappingResult = Result<z.infer<typeof DonorTemplateMappingDtoSchema> | null, AppError>;

export async function getTemplateMappingAction(templateId: string, version: number): Promise<GetTemplateMappingResult> {
  const context = await requireSession();
  return gatewayRequest(`/v1/templates/${templateId}/mappings/${version}`, DonorTemplateMappingDtoSchema.nullable(), context.token);
}

export type UpdateTemplateMappingResult = Result<{ mappingId: string }, AppError>;

/** Step 2: human corrections/confirmations of the auto-mapped regions. Marks each submitted region REVIEWED. */
export async function updateTemplateMappingAction(mappingId: string, regionUpdates: RegionUpdate[]): Promise<UpdateTemplateMappingResult> {
  const context = await requireSession();
  const parsed = UpdateTemplateMappingSchema.safeParse({ regionUpdates });
  if (!parsed.success) {
    return { ok: false, error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) } };
  }
  return gatewayRequest(`/v1/mappings/${mappingId}/regions`, z.object({ mappingId: z.string() }), context.token, {
    method: "PUT",
    body: parsed.data,
  });
}

export type ApproveTemplateMappingResult = Result<{ mappingId: string }, AppError>;

/** Step 3: approves the mapping — every mapped region must already be REVIEWED. */
export async function approveTemplateMappingAction(mappingId: string, file: File): Promise<ApproveTemplateMappingResult> {
  const context = await requireSession();
  if (!file || file.size === 0) {
    return { ok: false, error: { kind: "validation", message: "The original template file is required to approve.", fields: {} } };
  }
  const formData = new FormData();
  formData.set("file", file);
  return gatewayRequest(`/v1/mappings/${mappingId}/approve`, z.object({ mappingId: z.string() }), context.token, {
    method: "POST",
    formData,
  });
}

export type LockTemplateMappingResult = Result<undefined, AppError>;

/** Step 4: locks the approved mapping to a reporting period, so exports for that period use the donor-native rendering. */
export async function lockTemplateMappingAction(reportingPeriodId: string, mappingId: string): Promise<LockTemplateMappingResult> {
  const context = await requireSession();
  const parsed = LockTemplateMappingSchema.safeParse({ mappingId });
  if (!parsed.success) {
    return { ok: false, error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) } };
  }
  const result = await gatewayRequest(`/v1/reporting-periods/${reportingPeriodId}/lock-template-mapping`, OkResponseSchema, context.token, {
    method: "POST",
    body: parsed.data,
  });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}
