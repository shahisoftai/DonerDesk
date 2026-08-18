"use server";
import { redirect } from "next/navigation";
import { setSessionCookie, clearSessionCookie } from "@/lib/session-server";
import { cookies } from "next/headers";
import { safeRedirect } from "@/lib/shared/navigation";
import { AuthService, AuthFormError, type SignupInput } from "@/features/auth/application/auth-service";
import type { AuthFormState } from "@/features/auth/application/auth-schemas";

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
  if (!email || !password) {
    return { error: "Please enter your email and password.", fields: { email: ["Required"], password: ["Required"] } };
  }
  try {
    const { token } = await service.login(email, password);
    await setSessionCookie(token);
  } catch (err) {
    if (err instanceof AuthFormError) return err.state;
    return { error: "Unable to sign you in. Please try again." };
  }
  redirect(safeRedirect(next));
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

  try {
    const { token } = await service.signup(body);
    await setSessionCookie(token);
  } catch (err) {
    if (err instanceof AuthFormError) return err.state;
    return { error: "We could not create your account. Please try again." };
  }
  if (requestedPlan === "TEAM" || requestedPlan === "GROWTH") {
    redirect(`/checkout?plan=${requestedPlan.toLowerCase()}`);
  }
  redirect("/dashboard");
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
