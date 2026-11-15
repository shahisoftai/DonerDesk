"use server";

import { ChangeRoleSchema, InviteUserSchema, SetUserStatusSchema } from "@donordesk/contracts";
import { z } from "zod";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { flattenZodFields } from "@/lib/shared/validation";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";
import { InviteUserResponseSchema, OkResponseSchema } from "./_schemas";

export type InviteUserResult = Result<{ invitationId: string; token: string }, AppError>;

export async function inviteUserAction(input: unknown): Promise<InviteUserResult> {
  const context = await requireSession();
  const parsed = InviteUserSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) },
    };
  }
  return gatewayRequest("/v1/users/invite", InviteUserResponseSchema, context.token, {
    method: "POST",
    body: parsed.data,
  });
}

export type ChangeRoleResult = Result<undefined, AppError>;

export async function changeRoleAction(userId: string, role: string): Promise<ChangeRoleResult> {
  const context = await requireSession();
  const parsed = ChangeRoleSchema.safeParse({ userId, role });
  if (!parsed.success) {
    return {
      ok: false,
      error: { kind: "validation", message: "Please correct the highlighted fields.", fields: flattenZodFields(parsed.error) },
    };
  }
  const result = await gatewayRequest("/v1/users/role", OkResponseSchema, context.token, {
    method: "POST",
    body: parsed.data,
  });
  if (!result.ok) return result;
  return { ok: true, value: undefined };
}

export type SetUserStatusResult = Result<{ status: string }, AppError>;

/** Deactivate (reversible), reactivate, or delete (final; their records stay, named "Removed user") a team member. */
export async function setUserStatusAction(userId: string, action: "DEACTIVATE" | "REACTIVATE" | "DELETE"): Promise<SetUserStatusResult> {
  const context = await requireSession();
  const parsed = SetUserStatusSchema.safeParse({ action });
  if (!parsed.success) return { ok: false, error: { kind: "validation", message: "Unknown action.", fields: {} } };
  return gatewayRequest(`/v1/users/${encodeURIComponent(userId)}/status`, z.object({ status: z.string() }), context.token, { method: "POST", body: parsed.data });
}

export type CancelInvitationResult = Result<{ cancelled: true }, AppError>;

/** Withdraw an invitation nobody has accepted: its link stops working and its seat is free. */
export async function cancelInvitationAction(invitationId: string): Promise<CancelInvitationResult> {
  const context = await requireSession();
  return gatewayRequest(`/v1/users/invitations/${encodeURIComponent(invitationId)}`, z.object({ cancelled: z.literal(true) }), context.token, { method: "DELETE" });
}
