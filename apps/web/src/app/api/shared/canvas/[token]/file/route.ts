import { NextRequest } from "next/server";
import { apiBaseUrl } from "@/lib/server/api-gateway";

export const dynamic = "force-dynamic";

/** The kept copy a FROZEN link serves. No session: the link is the credential, and every unusable link answers the same 404. */
export async function GET(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return new Response("Not found", { status: 404 });
  let upstream: Response;
  try {
    upstream = await fetch(`${apiBaseUrl()}/public/canvases/${encodeURIComponent(token)}/file`, { cache: "no-store" });
  } catch {
    return new Response("Service unavailable", { status: 502 });
  }
  if (!upstream.ok) return new Response("Not found", { status: 404 });
  const headers = new Headers({ "cache-control": "private, no-store", "x-content-type-options": "nosniff", "x-robots-tag": "noindex, nofollow" });
  for (const name of ["content-type", "content-disposition"]) { const v = upstream.headers.get(name); if (v) headers.set(name, v); }
  return new Response(upstream.body, { status: 200, headers });
}
