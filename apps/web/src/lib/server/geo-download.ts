import { getSessionToken } from "@/lib/session-server";
import { apiBaseUrl } from "@/lib/server/api-gateway";

/** Passes a map file (GeoJSON or CSV, Phase 49.5) from the API to the browser as a download; the session stays on the server. */
export async function proxyGeoDownload(path: string): Promise<Response> {
  const token = await getSessionToken();
  if (!token) return new Response("Unauthorized", { status: 401 });
  let upstream: Response;
  try {
    upstream = await fetch(`${apiBaseUrl()}${path}`, { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
  } catch {
    return new Response("Service unavailable", { status: 502 });
  }
  if (!upstream.ok) return new Response("File unavailable", { status: upstream.status });
  const headers = new Headers({ "x-content-type-options": "nosniff", "cache-control": "private, no-store" });
  for (const name of ["content-type", "content-disposition", "x-unpinned"]) { const v = upstream.headers.get(name); if (v) headers.set(name, v); }
  return new Response(await upstream.arrayBuffer(), { status: 200, headers });
}
