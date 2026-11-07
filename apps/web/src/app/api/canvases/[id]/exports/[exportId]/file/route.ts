import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session-server";
import { apiBaseUrl } from "@/lib/server/api-gateway";

export const dynamic = "force-dynamic";

/** A kept copy of a canvas, handed to the signed-in person who may see the canvas. The session never leaves the server. */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string; exportId: string }> }) {
  const token = await getSessionToken();
  if (!token) return new Response("Unauthorized", { status: 401 });
  const { id, exportId } = await context.params;
  let upstream: Response;
  try {
    upstream = await fetch(`${apiBaseUrl()}/v1/canvases/${encodeURIComponent(id)}/exports/${encodeURIComponent(exportId)}/file`, { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
  } catch {
    return new Response("Service unavailable", { status: 502 });
  }
  const headers = new Headers({ "cache-control": "private, no-store", "x-content-type-options": "nosniff" });
  for (const name of ["content-type", "content-disposition"]) { const v = upstream.headers.get(name); if (v) headers.set(name, v); }
  return new Response(upstream.body, { status: upstream.status, headers });
}
