import { NextRequest, NextResponse } from "next/server";
import { completeGoogleDriveAuthAction } from "@/lib/actions/drive";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expected = request.cookies.get("dd_gdrive_state")?.value;
  if (!code || !state || state !== expected) {
    return NextResponse.redirect(new URL("/onboarding/storage?error=invalid_callback", request.url));
  }
  const result = await completeGoogleDriveAuthAction(code);
  if (!result.ok) {
    return NextResponse.redirect(new URL("/onboarding/storage?error=connect_failed", request.url));
  }
  return NextResponse.redirect(new URL("/onboarding", request.url));
}
