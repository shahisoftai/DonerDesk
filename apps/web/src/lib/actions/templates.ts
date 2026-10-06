"use server";

import { idempotency, type CreateOptions } from "./_idempotency";
import {
  CloneTemplateSchema,
  CreateDonorTemplateSchema,
  ReextractTemplateSchema,
  UpdateTemplateMetadataSchema,
  UpdateTemplateRequirementsSchema,
  UpdateTemplateSectionsSchema,
} from "@donordesk/contracts";
import { z } from "zod";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import {
  ParsedTemplateFileSchema,
  TemplateBriefPreviewSchema,
  TemplateDetailSchema,
  TemplateListItemSchema,
  TemplateVersionSnapshotSchema,
} from "@/lib/server/schemas";
import { OkResponseSchema } from "./_schemas";

const VersionResponseSchema = z.object({ ok: z.literal(true), version: z.number() });
const StatusResponseSchema = z.object({ status: z.string(), version: z.number().optional() });

function invalid(error: z.ZodError): { ok: false; error: AppError } {
  return { ok: false, error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(error) } };
}

export type ParsedTemplateFile = z.infer<typeof ParsedTemplateFileSchema>;

/** Uploads a template file: the api parses it with structure and stores the original. */
export async function parseTemplateFileAction(formData: FormData): Promise<Result<ParsedTemplateFile, AppError>> {
  const context = await requireSession();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: { kind: "validation", message: "Please select a non-empty file.", fields: {} } };
  }
  const body = new FormData();
  body.set("file", file);
  return gatewayRequest("/v1/templates/parse-file", ParsedTemplateFileSchema, context.token, { method: "POST", formData: body });
}

export type CreateTemplateResult = Result<{ id: string; status: string }, AppError>;

export async function createTemplateAction(input: unknown, options: CreateOptions = {}): Promise<CreateTemplateResult> {
  const context = await requireSession();
  const parsed = CreateDonorTemplateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const result = await gatewayRequest("/v1/templates", TemplateListItemSchema, context.token, { method: "POST", body: parsed.data, ...idempotency(options) });
  if (!result.ok) return result;
  return { ok: true, value: { id: result.value.id, status: result.value.status } };
}

export async function getTemplateAction(templateId: string) {
  const context = await requireSession();
  return gatewayRequest(`/v1/templates/${encodeURIComponent(templateId)}`, TemplateDetailSchema, context.token);
}

export async function updateTemplateSectionsAction(templateId: string, sections: unknown[], expectedVersion?: number): Promise<Result<{ version: number }, AppError>> {
  const context = await requireSession();
  const parsed = UpdateTemplateSectionsSchema.safeParse({ sections, expectedVersion });
  if (!parsed.success) return invalid(parsed.error);
  const result = await gatewayRequest(`/v1/templates/${encodeURIComponent(templateId)}/sections`, VersionResponseSchema, context.token, { method: "PUT", body: parsed.data });
  if (!result.ok) return result;
  return { ok: true, value: { version: result.value.version } };
}

export async function updateTemplateRequirementsAction(templateId: string, requirements: unknown, expectedVersion?: number): Promise<Result<{ version: number }, AppError>> {
  const context = await requireSession();
  const parsed = UpdateTemplateRequirementsSchema.safeParse({ requirements, expectedVersion });
  if (!parsed.success) return invalid(parsed.error);
  const result = await gatewayRequest(`/v1/templates/${encodeURIComponent(templateId)}/requirements`, VersionResponseSchema, context.token, { method: "PUT", body: parsed.data });
  if (!result.ok) return result;
  return { ok: true, value: { version: result.value.version } };
}

export async function updateTemplateMetadataAction(templateId: string, input: unknown): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const parsed = UpdateTemplateMetadataSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const result = await gatewayRequest(`/v1/templates/${encodeURIComponent(templateId)}`, OkResponseSchema, context.token, { method: "PATCH", body: parsed.data });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}

export async function reextractTemplateAction(templateId: string, input: unknown): Promise<Result<{ status: string }, AppError>> {
  const context = await requireSession();
  const parsed = ReextractTemplateSchema.safeParse(input ?? {});
  if (!parsed.success) return invalid(parsed.error);
  const result = await gatewayRequest(`/v1/templates/${encodeURIComponent(templateId)}/extract`, StatusResponseSchema, context.token, { method: "POST", body: parsed.data });
  if (!result.ok) return result;
  return { ok: true, value: { status: result.value.status } };
}

export async function markTemplateReviewedAction(templateId: string): Promise<Result<{ status: string }, AppError>> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/templates/${encodeURIComponent(templateId)}/review`, StatusResponseSchema, context.token, { method: "POST", body: {} });
  if (!result.ok) return result;
  return { ok: true, value: { status: result.value.status } };
}

export async function setTemplateLibraryAction(templateId: string, isLibrary: boolean): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/templates/${encodeURIComponent(templateId)}/library`, OkResponseSchema, context.token, { method: "PUT", body: { isLibrary } });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}

/** Sets or clears this template as its project's default (pre-selected for new reporting periods). */
export async function setTemplateDefaultAction(templateId: string, isDefault: boolean): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/templates/${encodeURIComponent(templateId)}/default`, OkResponseSchema, context.token, { method: "PUT", body: { isDefault } });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}

export async function cloneTemplateAction(templateId: string, projectId: string): Promise<Result<{ id: string }, AppError>> {
  const context = await requireSession();
  const parsed = CloneTemplateSchema.safeParse({ projectId });
  if (!parsed.success) return invalid(parsed.error);
  const result = await gatewayRequest(`/v1/templates/${encodeURIComponent(templateId)}/clone`, TemplateListItemSchema, context.token, { method: "POST", body: parsed.data });
  if (!result.ok) return result;
  return { ok: true, value: { id: result.value.id } };
}

export async function getTemplateVersionAction(templateId: string, version: number) {
  const context = await requireSession();
  return gatewayRequest(`/v1/templates/${encodeURIComponent(templateId)}/versions/${version}`, TemplateVersionSnapshotSchema, context.token);
}

export async function getTemplateBriefPreviewAction(templateId: string) {
  const context = await requireSession();
  return gatewayRequest(`/v1/templates/${encodeURIComponent(templateId)}/brief-preview`, TemplateBriefPreviewSchema, context.token);
}

export type DeleteTemplateResult = Result<undefined, AppError>;

export async function deleteTemplateAction(templateId: string): Promise<DeleteTemplateResult> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/templates/${encodeURIComponent(templateId)}`, OkResponseSchema, context.token, { method: "DELETE" });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}
