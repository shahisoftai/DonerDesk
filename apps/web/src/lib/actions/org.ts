"use server";

import { OrganizationProfileSchema, UpdateOrganizationReportingDefaultsSchema, UpdateAgentMemorySettingsSchema } from "@donordesk/contracts";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { OkResponseSchema } from "./_schemas";
import { MapLayerMetaResponseSchema } from "@/lib/server/schemas";

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

export type UpdateAgentMemorySettingsResult = Result<undefined, AppError>;

/** Agent Memory (Phase 21) tenant self-service toggle (§4.1). */
export async function updateAgentMemorySettingsAction(input: unknown): Promise<UpdateAgentMemorySettingsResult> {
  const context = await requireSession();
  const parsed = UpdateAgentMemorySettingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) },
    };
  }
  const result = await gatewayRequest("/v1/organization/agent-memory-settings", OkResponseSchema, context.token, {
    method: "PUT",
    body: parsed.data,
  });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}

export type UploadMapLayerResult = Result<{ name: string; featureCount: number }, AppError>;

/** The workspace's own map boundaries (Phase 30.1): one GeoJSON file; a new upload replaces the old layer. */
export async function uploadMapLayerAction(formData: FormData): Promise<UploadMapLayerResult> {
  const context = await requireSession();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: { kind: "validation", message: "Choose a GeoJSON file to upload.", fields: {} } };
  }
  const body = new FormData();
  body.set("file", file);
  const result = await gatewayRequest("/v1/organization/map-layer", MapLayerMetaResponseSchema, context.token, { method: "POST", formData: body });
  if (!result.ok) return result;
  return { ok: true, value: { name: result.value.name, featureCount: result.value.featureCount } };
}

export async function removeMapLayerAction(): Promise<Result<undefined, AppError>> {
  const context = await requireSession();
  const result = await gatewayRequest("/v1/organization/map-layer", OkResponseSchema, context.token, { method: "DELETE" });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}
