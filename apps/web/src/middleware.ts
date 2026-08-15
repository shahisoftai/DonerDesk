import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);

  const originHeader = headers.get("origin");
  if (originHeader && originHeader.includes(",")) {
    const first = originHeader.split(",")[0]!.trim();
    headers.set("origin", first);
  }

  headers.set("x-pathname", request.nextUrl.pathname + request.nextUrl.search);
  headers.set("x-url", request.url);

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    "/login",
    "/signup",
    "/forgot-password",
    "/logout",
    "/onboarding/:path*",
    "/dashboard/:path*",
    "/projects/:path*",
    "/team/:path*",
    "/my-work/:path*",
    "/reports/:path*",
    "/evidence/:path*",
    "/compliance/:path*",
    "/notifications/:path*",
    "/audit/:path*",
    "/settings/:path*",
  ],
};
