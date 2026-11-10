import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session-server";
import { apiBaseUrl } from "@/lib/server/api-gateway";

export const dynamic = "force-dynamic";

/** Who else has this canvas open, as a stream of server-sent events. The browser cannot send a bearer header on an event stream, so the session stays here. */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const token = await getSessionToken();
  if (!token) return new Response("Unauthorized", { status: 401 });
  const { id } = await context.params;
  let upstream: Response;
  try {
    upstream = await fetch(`${apiBaseUrl()}/v1/canvases/${encodeURIComponent(id)}/presence`, { headers: { authorization: `Bearer ${token}`, accept: "text/event-stream" }, cache: "no-store", signal: request.signal });
  } catch {
    return new Response("Service unavailable", { status: 502 });
  }
  if (!upstream.ok || !upstream.body) return new Response("Not available", { status: upstream.status === 404 ? 404 : 502 });
  return new Response(upstream.body, { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", "x-accel-buffering": "no", "x-content-type-options": "nosniff" } });
}
