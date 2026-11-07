import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session-server";
import { apiBaseUrl } from "@/lib/server/api-gateway";

export const dynamic = "force-dynamic";

/** A file of a saved canvas, made for the signed-in person from the records they can see. The session never leaves the server. */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const token = await getSessionToken();
  if (!token) return new Response("Unauthorized", { status: 401 });
  const { id } = await context.params;
  const query = new URL(request.url).searchParams;
  const format = query.get("format") ?? "PDF";
  const scale = query.get("scale");
  let upstream: Response;
  try {
    upstream = await fetch(`${apiBaseUrl()}/v1/canvases/${encodeURIComponent(id)}/export?format=${encodeURIComponent(format)}${scale ? `&scale=${encodeURIComponent(scale)}` : ""}`, { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
  } catch {
    return new Response("Service unavailable", { status: 502 });
  }
  const headers = new Headers({ "cache-control": "private, no-store", "x-content-type-options": "nosniff" });
  for (const name of ["content-type", "content-disposition", "x-canvas-skipped"]) { const v = upstream.headers.get(name); if (v) headers.set(name, v); }
  return new Response(upstream.body, { status: upstream.status, headers });
}
