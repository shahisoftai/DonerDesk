import { getSessionToken } from "@/lib/session-server";
import { apiBaseUrl } from "@/lib/server/api-gateway";

export const dynamic = "force-dynamic";

/** The workspace's uploaded map boundaries as GeoJSON (Phase 30.1) — the map's client fetch reads it with the session cookie. */
export async function GET() {
  const token = await getSessionToken();
  if (!token) return new Response("Unauthorized", { status: 401 });
  let upstream: Response;
  try {
    upstream = await fetch(`${apiBaseUrl()}/v1/organization/map-layer/data`, { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
  } catch {
    return new Response("Service unavailable", { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return new Response("The uploaded map boundaries are unavailable.", { status: upstream.status === 404 ? 404 : 502 });
  }
  return new Response(upstream.body, {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store" },
  });
}
