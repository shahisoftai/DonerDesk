"use server";

import { AssignProjectMemberSchema, UpdateProjectMemberSchema } from "@donordesk/contracts";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { IdResponseSchema, OkResponseSchema } from "./_schemas";

export type AssignProjectMemberResult = Result<{ id: string }, AppError>;

export async function assignProjectMemberAction(projectId: string, input: unknown): Promise<AssignProjectMemberResult> {
  const context = await requireSession();
  const parsed = AssignProjectMemberSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) },
    };
  }
  return gatewayRequest(`/v1/projects/${projectId}/members`, IdResponseSchema, context.token, {
    method: "POST",
    body: parsed.data,
  });
}

export type UpdateProjectMemberResult = Result<undefined, AppError>;

export async function updateProjectMemberAction(memberId: string, role: string): Promise<UpdateProjectMemberResult> {
  const context = await requireSession();
  const parsed = UpdateProjectMemberSchema.safeParse({ role });
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) },
    };
  }
  const result = await gatewayRequest(`/v1/project-members/${memberId}`, OkResponseSchema, context.token, {
    method: "PATCH",
    body: parsed.data,
  });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}

export type RemoveProjectMemberResult = Result<undefined, AppError>;

export async function removeProjectMemberAction(memberId: string): Promise<RemoveProjectMemberResult> {
  const context = await requireSession();
  const result = await gatewayRequest(`/v1/project-members/${memberId}`, OkResponseSchema, context.token, {
    method: "DELETE",
  });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}
