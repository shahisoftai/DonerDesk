import { apiBaseUrl } from "@/lib/server/api-gateway";

export const dynamic = "force-dynamic";

/**
 * A results map on a shared dashboard asking for another level or period (Phase 41.8). No session: the link is the credential, and the API
 * decides what it may read (only a results-map widget of that dashboard, for that widget's own project). Only these three questions are passed on.
 */
export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const widget = url.searchParams.get("widget") ?? "";
  const level = url.searchParams.get("level") ?? "";
  const periodId = url.searchParams.get("periodId");
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(widget) || !/^[0-4]$/.test(level) || (periodId !== null && !/^[A-Za-z0-9_-]{1,80}$/.test(periodId))) return new Response("Bad request", { status: 400 });
  const query = new URLSearchParams({ widget, level, ...(periodId ? { periodId } : {}) });
  let upstream: Response;
  try {
    upstream = await fetch(`${apiBaseUrl()}/public/dashboards/${encodeURIComponent(token)}/map-results?${query}`, { cache: "no-store" });
  } catch {
    return new Response("Service unavailable", { status: 502 });
  }
  if (!upstream.ok || !upstream.body) return new Response("This map is not available.", { status: upstream.status === 404 ? 404 : upstream.status === 400 ? 400 : 502 });
  return new Response(upstream.body, { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow" } });
}
