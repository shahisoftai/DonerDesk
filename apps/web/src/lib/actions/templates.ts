"use server";

import { CreateDonorTemplateSchema, UpdateTemplateSectionsSchema, TemplateSectionSchema } from "@donordesk/contracts";
import { z } from "zod";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { OkResponseSchema, TemplateCreatedResponseSchema } from "./_schemas";

export type CreateTemplateResult = Result<{ id: string; sections: unknown[] }, AppError>;

export async function createTemplateAction(input: unknown): Promise<CreateTemplateResult> {
  const context = await requireSession();
  const parsed = CreateDonorTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) },
    };
  }
  const result = await gatewayRequest("/v1/templates", TemplateCreatedResponseSchema, context.token, {
    method: "POST",
    body: parsed.data,
  });
  if (!result.ok) return result;
  return { ok: true, value: { id: result.value.id, sections: result.value.sections } };
}

export async function updateTemplateSectionsAction(
  templateId: string,
  sections: z.infer<typeof TemplateSectionSchema>[],
): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const parsed = UpdateTemplateSectionsSchema.safeParse({ sections });
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) },
    };
  }
  const result = await gatewayRequest(`/v1/templates/${templateId}/sections`, OkResponseSchema, context.token, {
    method: "PUT",
    body: parsed.data,
  });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}

export type DeleteTemplateResult = Result<undefined, AppError>;

export async function deleteTemplateAction(templateId: string): Promise<DeleteTemplateResult> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/templates/${templateId}`, OkResponseSchema, context.token, {
    method: "DELETE",
  });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}
