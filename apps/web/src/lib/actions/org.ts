"use server";

import { OrganizationProfileSchema, UpdateOrganizationReportingDefaultsSchema } from "@donordesk/contracts";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { OkResponseSchema } from "./_schemas";

export type UpdateOrganizationResult = Result<undefined, AppError>;

export async function updateOrganizationAction(input: unknown): Promise<UpdateOrganizationResult> {
  const context = await requireSession();
  const parsed = OrganizationProfileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) },
    };
  }
  const result = await gatewayRequest("/v1/organization", OkResponseSchema, context.token, {
    method: "PUT",
    body: parsed.data,
  });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}

export type UpdateOrganizationReportingDefaultsResult = Result<undefined, AppError>;

export async function updateOrganizationReportingDefaultsAction(input: unknown): Promise<UpdateOrganizationReportingDefaultsResult> {
  const context = await requireSession();
  const parsed = UpdateOrganizationReportingDefaultsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) },
    };
  }
  const result = await gatewayRequest("/v1/organization/reporting-defaults", OkResponseSchema, context.token, {
    method: "PUT",
    body: parsed.data,
  });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}
