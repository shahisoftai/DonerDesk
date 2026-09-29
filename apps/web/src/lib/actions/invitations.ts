"use server";

import { redirect } from "next/navigation";
import { setSessionCookie } from "@/lib/session-server";
import { AuthService, AuthFormError } from "@/features/auth/application/auth-service";
import type { AuthFormState } from "@/features/auth/application/auth-schemas";

const service = new AuthService();

export type AcceptInvitationActionResult = AuthFormState;

/**
 * Redeems an invitation token (WS-C acceptance flow): creates the member,
 * marks the invitation accepted, and signs the new user in.
 */
export async function acceptInvitationAction(
  _prev: AuthFormState | null,
  form: FormData,
): Promise<AuthFormState> {
  const token = String(form.get("token") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  const password = String(form.get("password") ?? "");

  const fields: Record<string, string[]> = {};
  if (token.length < 10) fields.token = ["Invalid invitation link"];
  if (name.length < 2) fields.name = ["Please enter your full name"];
  if (password.length < 8) fields.password = ["Use at least 8 characters"];
  if (Object.keys(fields).length > 0) {
    return { error: "Please correct the highlighted fields.", fields };
  }

  let sessionToken: string;
  try {
    const result = await service.acceptInvitation(token, name, password);
    sessionToken = result.token;
  } catch (err) {
    if (err instanceof AuthFormError) return err.state;
    return { error: "We could not accept this invitation. It may have expired or already been used." };
  }
  await setSessionCookie(sessionToken);
  redirect("/dashboard");
}
