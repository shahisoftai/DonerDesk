"use server";

import { z } from "zod";
import { apiBaseUrl } from "@/lib/server/api-gateway";
import {
  ChangePasswordResponseSchema,
  PasswordResetAcceptedResponseSchema,
  PasswordResetValidationResponseSchema,
  ConfirmPasswordResetResponseSchema,
} from "@/lib/actions/password-schemas";
import { requireSession } from "@/lib/server/auth-context";

export type ChangePasswordActionResult =
  | { ok: true }
  | { ok: false; error: string; fields?: Record<string, string[]> };

export async function changePasswordAction(input: {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}): Promise<ChangePasswordActionResult> {
  const ctx = await requireSession();
  const body = z
    .object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(12).max(200),
    })
    .safeParse(input);
  if (!body.success) {
    return { ok: false, error: "Please correct the highlighted fields.", fields: flattenZod(body.error) };
  }
  const response = await fetch(`${apiBaseUrl()}/v1/auth/password/change`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${ctx.token}` },
    body: JSON.stringify(body.data),
    cache: "no-store",
  });
  return await toResult(response, ChangePasswordResponseSchema, "We could not change your password. Please try again.");
}

export type RequestResetActionResult = { ok: true } | { ok: false; error: string };

export async function requestPasswordResetAction(input: { email: string }): Promise<RequestResetActionResult> {
  const body = z.object({ email: z.string().email() }).safeParse(input);
  if (!body.success) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  const response = await fetch(`${apiBaseUrl()}/v1/auth/password/reset/request`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body.data),
    cache: "no-store",
  });
  return await toSimpleResult(response, PasswordResetAcceptedResponseSchema, "We could not send the reset link. Please try again.");
}

export type ValidateResetActionResult = { ok: true; valid: boolean } | { ok: false; error: string };

export async function validateResetTokenAction(token: string): Promise<ValidateResetActionResult> {
  if (!token || token.length < 20) return { ok: true, valid: false };
  const response = await fetch(`${apiBaseUrl()}/v1/auth/password/reset/validate?token=${encodeURIComponent(token)}`, {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  const result = await toSimpleResult(response, PasswordResetValidationResponseSchema, "We could not validate the link.");
  if (result.ok) return { ok: true, valid: result.value.valid };
  return result;
}

export type ConfirmResetActionResult = { ok: true } | { ok: false; error: string; fields?: Record<string, string[]> };

export async function confirmPasswordResetAction(input: {
  token: string;
  newPassword: string;
}): Promise<ConfirmResetActionResult> {
  const body = z.object({ token: z.string().min(20), newPassword: z.string().min(12).max(200) }).safeParse(input);
  if (!body.success) {
    return { ok: false, error: "Please choose a stronger password.", fields: flattenZod(body.error) };
  }
  const response = await fetch(`${apiBaseUrl()}/v1/auth/password/reset/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body.data),
    cache: "no-store",
  });
  return await toResult(response, ConfirmPasswordResetResponseSchema, "We could not reset your password. Please try again.");
}

async function toResult<T>(response: Response, schema: z.ZodType<T>, fallbackMessage: string): Promise<{ ok: true; value: T } | { ok: false; error: string; fields?: Record<string, string[]> }> {
  if (!response.ok) {
    const problem = await safeProblem(response);
    if (response.status === 400 && problem.fields) {
      return { ok: false, error: problem.message ?? "Please correct the highlighted fields.", fields: problem.fields };
    }
    return { ok: false, error: problem.message ?? fallbackMessage };
  }
  const data = await response.json().catch(() => null);
  const parsed = schema.safeParse(data);
  if (!parsed.success) return { ok: false, error: fallbackMessage };
  return { ok: true, value: parsed.data };
}

async function toSimpleResult<T>(response: Response, schema: z.ZodType<T>, fallbackMessage: string): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  if (!response.ok) {
    const problem = await safeProblem(response);
    return { ok: false, error: problem.message ?? fallbackMessage };
  }
  const data = await response.json().catch(() => null);
  const parsed = schema.safeParse(data);
  if (!parsed.success) return { ok: false, error: fallbackMessage };
  return { ok: true, value: parsed.data };
}

async function safeProblem(response: Response): Promise<{ message?: string; fields?: Record<string, string[]> }> {
  const text = await response.text().catch(() => "");
  try {
    const body = JSON.parse(text) as { title?: string; message?: string; errors?: Record<string, unknown> };
    const fields: Record<string, string[]> = {};
    if (body.errors) {
      for (const [key, value] of Object.entries(body.errors)) {
        fields[key] = Array.isArray(value) ? value.map(String) : [String(value)];
      }
    }
    return { message: body.message ?? body.title, ...(Object.keys(fields).length > 0 ? { fields } : {}) };
  } catch {
    return {};
  }
}

function flattenZod(error: z.ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_";
    if (!fields[path]) fields[path] = [];
    fields[path].push(issue.message);
  }
  return fields;
}
