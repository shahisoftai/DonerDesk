import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const originHeader: string | null = request.headers.get("origin");
  const origin: string = originHeader === null ? "" : originHeader;
  if (origin.length > 0 && origin.includes(",")) {
    const headers = new Headers(request.headers);
    const firstPart: string | undefined = origin.split(",")[0];
    const first = firstPart === undefined ? "" : firstPart.trim();
    if (first.length > 0) headers.set("origin", first);
    return NextResponse.next({ request: { headers } });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/signup", "/login", "/logout"],
};
