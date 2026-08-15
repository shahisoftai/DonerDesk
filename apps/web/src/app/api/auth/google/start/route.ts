import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const OAUTH_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export async function GET() {
  const clientId = required("GOOGLE_DRIVE_CLIENT_ID");
  const redirectUri = `${required("APP_URL").replace(/\/$/, "")}/api/auth/google/callback`;
  const state = randomBytes(24).toString("base64url");
  const authorize = new URL(OAUTH_AUTH_URL);
  authorize.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    prompt: "select_account",
    state,
  }).toString();
  const response = NextResponse.redirect(authorize);
  response.cookies.set("dd_google_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Lax so the cookie is sent on the cross-site top-level redirect back from
    // Google (Strict would withhold it and break the state check).
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for Google Sign-In`);
  return value;
}
