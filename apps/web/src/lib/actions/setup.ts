"use server";

import { z } from "zod";
import { UpsertReportingProfileSchema } from "@donordesk/contracts";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { ProjectSetupResponseSchema, ReportingProfileResponseSchema } from "@/lib/server/schemas";
import { IdResponseSchema } from "./_schemas";

export type SetupLoad = Result<{ setup: import("@/lib/server/schemas").ProjectSetupResponse }, AppError>;

export async function loadProjectSetupAction(projectId: string): Promise<SetupLoad> {
  const context = await requireSession();
  const result = await gatewayRequest(
    `/v1/projects/${projectId}/setup`,
    ProjectSetupResponseSchema,
    context.token,
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, value: { setup: result.value } };
}

export async function acknowledgeProjectSetupAction(projectId: string): Promise<Result<{ acknowledged: boolean }, AppError>> {
  const context = await requireSession();
  return gatewayRequest(`/v1/projects/${projectId}/setup/acknowledge`, z.object({ acknowledged: z.boolean() }), context.token, {
    method: "POST",
    body: { acknowledged: true },
  });
}

export async function retryProjectWorkspaceAction(projectId: string): Promise<Result<{ provisionStatus: string }, AppError>> {
  const context = await requireSession();
  return gatewayRequest(
    `/v1/projects/${projectId}/workspace/retry`,
    z.object({ provisionStatus: z.string(), reference: z.any().optional(), error: z.string().optional() }),
    context.token,
    { method: "POST", body: {} },
  );
}

export async function repairProjectWorkspaceAction(projectId: string): Promise<Result<{ provisionStatus: string }, AppError>> {
  const context = await requireSession();
  return gatewayRequest(
    `/v1/projects/${projectId}/workspace/repair`,
    z.object({ provisionStatus: z.string(), reference: z.any().optional(), error: z.string().optional() }),
    context.token,
    { method: "POST", body: {} },
  );
}

export type ReportingProfileLoad = Result<{ profile: import("@/lib/server/schemas").ReportingProfile | null }, AppError>;

export async function loadReportingProfileAction(projectId: string): Promise<ReportingProfileLoad> {
  const context = await requireSession();
  const result = await gatewayRequest(
    `/v1/projects/${projectId}/reporting-profile`,
    ReportingProfileResponseSchema,
    context.token,
  );
  if (!result.ok) return { ok: false, error: result.error };
  // The DTO always serializes every profile field; the schema output is widened
  // at the gateway boundary, so map it to the canonical type here.
  return { ok: true, value: { profile: result.value.profile as import("@/lib/server/schemas").ReportingProfile | null } };
}

export async function upsertReportingProfileAction(
  projectId: string,
  input: unknown,
): Promise<Result<{ id: string }, AppError>> {
  const context = await requireSession();
  const parsed = UpsertReportingProfileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) },
    };
  }
  return gatewayRequest(`/v1/projects/${projectId}/reporting-profile`, IdResponseSchema, context.token, {
    method: "PUT",
    body: parsed.data,
  });
}
