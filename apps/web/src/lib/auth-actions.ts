"use server";
import { redirect } from "next/navigation";
import { setSessionCookie, clearSessionCookie } from "@/lib/session-server";
import { cookies } from "next/headers";
import { safeRedirect } from "@/lib/shared/navigation";
import { AuthService, AuthFormError, type SignupInput } from "@/features/auth/application/auth-service";
import type { AuthFormState } from "@/features/auth/application/auth-schemas";
import { gatewayRequest } from "@/lib/server/api-gateway";
import { LegalConsentSchema } from "@/lib/server/schemas";

const service = new AuthService();

export type LoginActionResult = AuthFormState;
export type SignupActionResult = AuthFormState;

export async function loginAction(
  _prev: AuthFormState | null,
  form: FormData,
): Promise<AuthFormState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "");
  const challenge = String(form.get("challenge") ?? "");
  const code = String(form.get("code") ?? "").trim();

  let landing = "";
  // Step two: the person answered the code prompt.
  if (challenge) {
    if (!code) return { error: "Enter the code from your authenticator app.", fields: { code: ["Required"] }, mfaChallenge: challenge };
    try {
      const { token } = await service.loginMfa(challenge, code);
      await setSessionCookie(token);
      landing = await landingAfterSignIn(token, next);
    } catch (err) {
      // A wrong code keeps the prompt open; an expired or refused sign-in starts again from the password.
      if (err instanceof AuthFormError) return { ...err.state, mfaChallenge: /too long|start again/i.test(err.state.error ?? "") ? undefined : challenge };
      return { error: "Unable to sign you in. Please try again." };
    }
    redirect(landing);
  }

  if (!email || !password) {
    return { error: "Please enter your email and password.", fields: { email: ["Required"], password: ["Required"] } };
  }
  try {
    const result = await service.login(email, password);
    if ("mfaChallenge" in result) return { error: null, mfaChallenge: result.mfaChallenge };
    await setSessionCookie(result.token);
    landing = await landingAfterSignIn(result.token, next);
  } catch (err) {
    if (err instanceof AuthFormError) return err.state;
    return { error: "Unable to sign you in. Please try again." };
  }
  redirect(landing);
}

export async function signupAction(
  _prev: AuthFormState | null,
  form: FormData,
): Promise<AuthFormState> {
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const orgName = String(form.get("orgName") ?? "").trim();
  const country = String(form.get("country") ?? "").trim();
  const requestedPlan = normalizeRequestedPlan(form.get("plan"));
  // Server-side re-check of the trials flag: the checkbox not rendering is UI
  // gating only; a crafted form post must not start a trial with the flag off
  // (the api's ProvisionTenantHandler enforces the same switch again, off
  // TRIALS_ENABLED only — not NEXT_PUBLIC_TRIALS_ENABLED, so this check must
  // not OR the two either, or setting only the public marketing flag would
  // request a trial that only the web layer thought was authorized).
  const trialsEnabled = process.env.TRIALS_ENABLED === "1";
  const startTrial =
    trialsEnabled &&
    form.get("startTrial") === "on" &&
    (requestedPlan === "TEAM" || requestedPlan === "GROWTH");

  if (!name || !email || !password || !orgName || !country) {
    const fields: Record<string, string[]> = {};
    if (!name) fields.name = ["Required"];
    if (!email) fields.email = ["Required"];
    if (!password) fields.password = ["Required"];
    if (!orgName) fields.orgName = ["Required"];
    if (!country) fields.country = ["Required"];
    return { error: "Please complete the highlighted fields.", fields };
  }

  const body: SignupInput = {
    name,
    email,
    password,
    requestedPlan,
    startTrial,
    organization: {
      name: orgName,
      organizationType: String(form.get("orgType") ?? "LOCAL_NGO"),
      country,
      primarySector: String(form.get("sector") ?? "NUTRITION"),
      defaultLanguage: "en",
      dataResidency: String(form.get("dataResidency") ?? "DEFAULT"),
      aiEnabled: form.get("aiEnabled") === "on",
    },
  };

  let trialGranted = false;
  try {
    const result = await service.signup(body);
    trialGranted = result.trialGranted;
    await setSessionCookie(result.token);
  } catch (err) {
    if (err instanceof AuthFormError) return err.state;
    return { error: "We could not create your account. Please try again." };
  }
  if ((requestedPlan === "TEAM" || requestedPlan === "GROWTH") && !trialGranted) {
    redirect(`/checkout?plan=${requestedPlan.toLowerCase()}`);
  }
  // A new account has not accepted the terms yet: land on onboarding directly (see landingAfterSignIn).
  redirect("/onboarding");
}

/**
 * Where a person lands after signing in. A redirect from a server action is streamed through an internal
 * request; if the portal layout's terms gate then redirects again (e.g. /dashboard -> /onboarding), the
 * client receives a half-applied page that renders blank until a hard refresh. So the gate is applied
 * here, before the first redirect. A failed check falls back to the asked-for page (the layout still gates).
 */
async function landingAfterSignIn(token: string, next: string): Promise<string> {
  const consent = await gatewayRequest("/v1/legal/consent", LegalConsentSchema, token);
  if (consent.ok && !consent.value.accepted) return "/onboarding";
  return safeRedirect(next);
}

/** Only allowlist values survive; anything else becomes STARTER. */
function normalizeRequestedPlan(value: FormDataEntryValue | null): "STARTER" | "TEAM" | "GROWTH" | undefined {
  const raw = String(value ?? "").toUpperCase();
  if (raw === "TEAM") return "TEAM";
  if (raw === "GROWTH") return "GROWTH";
  return "STARTER";
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}

export async function getCookie(name: string): Promise<string | null> {
  return (await cookies()).get(name)?.value ?? null;
}
