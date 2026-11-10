import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session-server";
import { apiBaseUrl } from "@/lib/server/api-gateway";

export const dynamic = "force-dynamic";

/** The offline street map for a project's area (Phase 49.4): `?check=1` answers its size, otherwise the file. The session stays on the server. */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const token = await getSessionToken();
  if (!token) return new Response("Unauthorized", { status: 401 });
  const { id } = await context.params;
  const q = request.nextUrl.searchParams;
  const out = new URLSearchParams({ bbox: q.get("bbox") ?? "" });
  if (q.get("check")) out.set("check", "1");
  let upstream: Response;
  try {
    upstream = await fetch(`${apiBaseUrl()}/v1/projects/${encodeURIComponent(id)}/offline-basemap?${out}`, { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
  } catch {
    return new Response("Service unavailable", { status: 502 });
  }
  if (!upstream.ok) return new Response(await upstream.text(), { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") ?? "text/plain" } });
  const headers = new Headers({ "cache-control": "private, no-store", "x-content-type-options": "nosniff", "content-type": upstream.headers.get("content-type") ?? "application/octet-stream" });
  const length = upstream.headers.get("content-length");
  if (length) headers.set("content-length", length);
  return new Response(upstream.body, { status: 200, headers });
}
