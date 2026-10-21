"use server";

import { z } from "zod";
import { requireSession } from "@/lib/server/auth-context";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { MfaSetupSchema, MfaEnabledSchema } from "@/lib/server/schemas";
import type { Result } from "@/lib/shared/result";
import type { AppError } from "@/lib/shared/app-error";

const fail = (message: string, fields: Record<string, string[]> = {}): Result<never, AppError> => ({ ok: false, error: { kind: "validation", message, fields } });

/** Step one: a new secret to add to an authenticator app. Nothing is protected until step two. */
export async function beginMfaAction(): Promise<Result<z.infer<typeof MfaSetupSchema>, AppError>> {
  const context = await requireSession();
  return gatewayRequest("/v1/auth/mfa/setup", MfaSetupSchema, context.token, { method: "POST", body: {} });
}

/** Step two: the first code from the app turns it on; the recovery codes come back once. */
export async function enableMfaAction(code: string): Promise<Result<z.infer<typeof MfaEnabledSchema>, AppError>> {
  const context = await requireSession();
  if (!code.trim()) return fail("Enter the 6-digit code from your app.", { code: ["Required"] });
  return gatewayRequest("/v1/auth/mfa/enable", MfaEnabledSchema, context.token, { method: "POST", body: { code: code.trim() } });
}

/** Turning it off needs the password and a current code (or a recovery code). */
export async function disableMfaAction(password: string, code: string): Promise<Result<true, AppError>> {
  const context = await requireSession();
  if (!password) return fail("Enter your password.", { password: ["Required"] });
  if (!code.trim()) return fail("Enter a code from your app, or a recovery code.", { code: ["Required"] });
  const r = await gatewayRequest("/v1/auth/mfa/disable", z.object({ disabled: z.boolean() }), context.token, { method: "POST", body: { password, code: code.trim() } });
  return r.ok ? { ok: true, value: true } : r;
}

/** An administrator clears a teammate's two-step sign-in (a lost phone). */
export async function resetUserMfaAction(userId: string): Promise<Result<true, AppError>> {
  const context = await requireSession();
  const r = await gatewayRequest(`/v1/users/${encodeURIComponent(userId)}/mfa/reset`, z.object({ reset: z.boolean() }), context.token, { method: "POST", body: {} });
  return r.ok ? { ok: true, value: true } : r;
}
