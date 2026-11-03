import { getSessionToken } from "@/lib/session-server";
import { apiBaseUrl } from "@/lib/server/api-gateway";

export const dynamic = "force-dynamic";

/** One uploaded boundary file as GeoJSON (Phase 41.7): the map's client fetch reads it with the session cookie. */
export async function GET(_request: Request, context: { params: Promise<{ iso: string; level: string }> }) {
  const { iso, level } = await context.params;
  if (!/^[A-Za-z]{3}$/.test(iso) || !/^[1-4]$/.test(level)) return new Response("Not found", { status: 404 });
  const token = await getSessionToken();
  if (!token) return new Response("Unauthorized", { status: 401 });
  let upstream: Response;
  try {
    upstream = await fetch(`${apiBaseUrl()}/v1/organization/boundary-layers/${iso}/${level}/data`, { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
  } catch {
    return new Response("Service unavailable", { status: 502 });
  }
  if (!upstream.ok || !upstream.body) return new Response("The uploaded boundaries are unavailable.", { status: upstream.status === 404 ? 404 : 502 });
  return new Response(upstream.body, { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store" } });
}
