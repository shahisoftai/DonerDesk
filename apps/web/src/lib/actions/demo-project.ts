"use server";

import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { IdResponseSchema, OkResponseSchema } from "./_schemas";
import { z } from "zod";

const CreateDemoProjectResponseSchema = IdResponseSchema.extend({ reused: z.boolean() });

export type CreateDemoProjectResult = Result<{ id: string; reused: boolean }, AppError>;

/**
 * DonorDesk Academy (Feature 22): idempotent — returns the tenant's existing
 * demo project if one was already created rather than making a duplicate.
 */
export async function createDemoProjectAction(): Promise<CreateDemoProjectResult> {
  const context = await requireSession();
  return gatewayRequest("/v1/projects/demo", CreateDemoProjectResponseSchema, context.token, {
    method: "POST",
  });
}

export type DeleteDemoProjectResult = Result<undefined, AppError>;

export async function deleteDemoProjectAction(projectId: string): Promise<DeleteDemoProjectResult> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/projects/${projectId}/demo`, OkResponseSchema, context.token, {
    method: "DELETE",
  });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}
