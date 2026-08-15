import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/features/auth/application/auth-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const appUrl = appOrigin();
  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const expectedState = request.cookies.get("dd_google_state")?.value;
  if (!state || !code || state !== expectedState) {
    return NextResponse.redirect(new URL("/login?error=invalid_callback", appUrl));
  }

  let token: string;
  let provisioned = false;
  try {
    const requestedPlan = parsePlanFromState(state);
    ({ token, provisioned } = await new AuthService().googleSignIn(code, requestedPlan));
  } catch {
    return NextResponse.redirect(new URL("/login?error=google_failed", appUrl));
  }

  const response = NextResponse.redirect(new URL(provisioned ? "/onboarding" : "/dashboard", appUrl));
  response.cookies.set("dd_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Lax: the session is established from a cross-site top-level navigation
    // (Google -> callback), so Strict would withhold it on the /dashboard follow-up.
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  response.cookies.delete("dd_google_state");
  return response;
}

/** Extract the validated plan suffix from the OAuth state (starts with ":plan"). */
function parsePlanFromState(state: string): "STARTER" | "TEAM" | "GROWTH" | undefined {
  const parts = state.split(":");
  const plan = parts[parts.length - 1]?.toUpperCase();
  if (plan === "TEAM") return "TEAM";
  if (plan === "GROWTH") return "GROWTH";
  if (plan === "STARTER") return "STARTER";
  return undefined;
}

/** Public origin used for post-OAuth redirects (never the internal host). */
function appOrigin(): string {
  const value = process.env.APP_URL;
  if (!value) throw new Error("APP_URL is required for Google Sign-In redirects");
  return value.replace(/\/+$/, "");
}
