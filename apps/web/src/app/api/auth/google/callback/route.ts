import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/features/auth/application/auth-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const expectedState = request.cookies.get("dd_google_state")?.value;
  if (!state || !code || state !== expectedState) {
    return NextResponse.redirect(new URL("/login?error=invalid_callback", request.url));
  }

  let token: string;
  try {
    ({ token } = await new AuthService().googleSignIn(code));
  } catch {
    return NextResponse.redirect(new URL("/login?error=google_failed", request.url));
  }

  const response = NextResponse.redirect(new URL("/dashboard", request.url));
  response.cookies.set("dd_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  response.cookies.delete("dd_google_state");
  return response;
}
