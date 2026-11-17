import { NextRequest } from "next/server";
import { apiBaseUrl } from "@/lib/server/api-gateway";

export const dynamic = "force-dynamic";

/** A picture on a canvas a LIVE link opens. No session: the link is the credential, only a picture the canvas names is served, and every other case answers the same 404. */
export async function GET(_request: NextRequest, context: { params: Promise<{ token: string; assetId: string }> }) {
  const { token, assetId } = await context.params;
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token) || !/^[A-Za-z0-9_-]{1,80}$/.test(assetId)) return new Response("Not found", { status: 404 });
  let upstream: Response;
  try {
    upstream = await fetch(`${apiBaseUrl()}/public/canvases/${encodeURIComponent(token)}/assets/${encodeURIComponent(assetId)}`, { cache: "no-store" });
  } catch {
    return new Response("Service unavailable", { status: 502 });
  }
  if (!upstream.ok) return new Response("Not found", { status: 404 });
  const type = upstream.headers.get("content-type") ?? "application/octet-stream";
  if (!/^image\/(png|jpeg)$/.test(type)) return new Response("Not found", { status: 404 });
  return new Response(upstream.body, { status: 200, headers: { "content-type": type, "cache-control": "private, no-store", "x-content-type-options": "nosniff", "x-robots-tag": "noindex, nofollow" } });
}
