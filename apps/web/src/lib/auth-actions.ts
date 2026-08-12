"use server";
import { redirect } from "next/navigation";
import { setSessionCookie, clearSessionCookie } from "@/lib/session-server";
import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? "http://localhost:4000";

export async function loginAction(_prev: { error: string | null } | null, form: FormData): Promise<{ error: string | null }> {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const res = await fetch(`${API_URL}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { title?: string };
    return { error: body.title ?? "Invalid credentials" };
  }
  const data = (await res.json()) as { token: string };
  await setSessionCookie(data.token);
  redirect("/dashboard");
}

export async function signupAction(_prev: { error: string | null } | null, form: FormData): Promise<{ error: string | null }> {
  const body = {
    name: String(form.get("name") ?? ""),
    email: String(form.get("email") ?? ""),
    password: String(form.get("password") ?? ""),
    organization: {
      name: String(form.get("orgName") ?? ""),
      organizationType: String(form.get("orgType") ?? "LOCAL_NGO"),
      country: String(form.get("country") ?? ""),
      primarySector: String(form.get("sector") ?? "NUTRITION"),
      defaultLanguage: "en",
      dataResidency: String(form.get("dataResidency") ?? "DEFAULT"),
      aiEnabled: form.get("aiEnabled") === "on",
    },
  };
  const res = await fetch(`${API_URL}/v1/auth/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as { title?: string };
    return { error: errBody.title ?? "Sign-up failed" };
  }
  const data = (await res.json()) as { token: string };
  await setSessionCookie(data.token);
  redirect("/dashboard");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}

export async function getCookie(name: string): Promise<string | null> {
  return (await cookies()).get(name)?.value ?? null;
}
