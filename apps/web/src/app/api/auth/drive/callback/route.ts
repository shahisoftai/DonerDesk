import { NextRequest, NextResponse } from "next/server";
import { completeGoogleDriveAuthAction } from "@/lib/actions/drive";

export async function GET(request: NextRequest) {
  const appUrl = appOrigin();
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expected = request.cookies.get("dd_gdrive_state")?.value;
  if (!code || !state || state !== expected) {
    return NextResponse.redirect(new URL("/onboarding/storage?error=invalid_callback", appUrl));
  }
  const result = await completeGoogleDriveAuthAction(code);
  if (!result.ok) {
    return NextResponse.redirect(new URL("/onboarding/storage?error=connect_failed", appUrl));
  }
  return NextResponse.redirect(new URL("/onboarding", appUrl));
}

/** Public origin used for post-OAuth redirects (never the internal host). */
function appOrigin(): string {
  const value = process.env.APP_URL;
  if (!value) throw new Error("APP_URL is required for Drive OAuth redirects");
  return value.replace(/\/+$/, "");
}
