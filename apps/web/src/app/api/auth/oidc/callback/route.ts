import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const expectedState = request.cookies.get("dd_oidc_state")?.value;
  const verifier = request.cookies.get("dd_oidc_verifier")?.value;
  if (!state || !code || !verifier || state !== expectedState) {
    return NextResponse.json({ title: "Invalid OIDC callback" }, { status: 400 });
  }
  const issuer = required("OIDC_ISSUER").replace(/\/$/, "");
  const redirectUri = `${required("APP_URL").replace(/\/$/, "")}/api/auth/oidc/callback`;
  const tokenResponse = await fetch(`${issuer}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: required("OIDC_CLIENT_ID"),
      redirect_uri: redirectUri,
      code,
      code_verifier: verifier,
    }),
    cache: "no-store",
  });
  if (!tokenResponse.ok) return NextResponse.json({ title: "OIDC token exchange failed" }, { status: 401 });
  const tokens = await tokenResponse.json() as { access_token: string; expires_in?: number };
  const response = NextResponse.redirect(new URL("/dashboard", request.url));
  response.cookies.set("dd_session", tokens.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: tokens.expires_in ?? 300,
  });
  response.cookies.delete("dd_oidc_state");
  response.cookies.delete("dd_oidc_verifier");
  return response;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for OIDC login`);
  return value;
}
