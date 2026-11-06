import { NextRequest } from "next/server";
import { apiBaseUrl } from "@/lib/server/api-gateway";

export const dynamic = "force-dynamic";

/** The file behind a public share link. No session: the link's token is the whole credential, and the API answers 404 for anything but a live link. */
export async function GET(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return new Response("This link is not available.", { status: 404 });
  let upstream: Response;
  try {
    upstream = await fetch(`${apiBaseUrl()}/public/infographics/${encodeURIComponent(token)}`, { cache: "no-store" });
  } catch {
    return new Response("Service unavailable", { status: 502 });
  }
  if (!upstream.ok || !upstream.body) return new Response("This link is not available.", { status: 404 });
  return new Response(upstream.body, {
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "content-disposition": upstream.headers.get("content-disposition") ?? "inline",
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex, nofollow",
      "x-content-type-options": "nosniff",
    },
  });
}
