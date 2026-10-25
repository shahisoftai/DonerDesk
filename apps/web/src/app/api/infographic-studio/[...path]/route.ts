import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session-server";
import { apiBaseUrl } from "@/lib/server/api-gateway";

export const dynamic = "force-dynamic";

/**
 * The Infographic Studio's one gateway to the API (Phase 32): the browser calls `/api/infographic-studio/<api path>` and
 * this forwards the call with the person's session token. Only the Studio's own paths pass; the API still decides who may
 * do what (every route has its own permission rule). Images and exported files are streamed back untouched.
 */
const STUDIO_ROOTS = new Set(["infographics", "infographic-assets", "infographic-templates", "infographic-brand", "infographic-share-links"]);
const ID = /^[A-Za-z0-9_-]{1,80}$/;

function allowed(segments: string[]): boolean {
  if (segments.length === 0 || segments.some((s) => !ID.test(s))) return false;
  if (STUDIO_ROOTS.has(segments[0] as string)) return true;
  // A project's own suggestions: projects/<id>/infographic-suggestions.
  if (segments[0] === "projects" && segments.length === 3 && segments[2] === "infographic-presence") return true;
  if (segments[0] === "projects") return segments[2] === "infographic-suggestions" && (segments.length === 3 || (segments.length === 4 && segments[3] === "ai"));
  // The pictures placed in a report section: report-sections/<id>/infographics[/candidates | /<pictureId>[/move]].
  return segments[0] === "report-sections" && segments[2] === "infographics" && segments.length <= 5;
}

async function forward(request: NextRequest, context: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path } = await context.params;
  if (!allowed(path)) return new Response("Not found", { status: 404 });
  const token = await getSessionToken();
  if (!token) return new Response("Unauthorized", { status: 401 });
  const hasBody = request.method !== "GET" && request.method !== "DELETE";
  const body = hasBody ? await request.text() : undefined;
  const query = new URL(request.url).search;
  let upstream: Response;
  try {
    upstream = await fetch(`${apiBaseUrl()}/v1/${path.map(encodeURIComponent).join("/")}${query}`, {
      method: request.method,
      headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) },
      body,
      cache: "no-store",
    });
  } catch {
    return new Response("Service unavailable", { status: 502 });
  }
  const headers = new Headers({ "cache-control": upstream.headers.get("cache-control") ?? "private, no-store" });
  headers.set("content-type", upstream.headers.get("content-type") ?? "application/json; charset=utf-8");
  const disposition = upstream.headers.get("content-disposition");
  if (disposition) headers.set("content-disposition", disposition);
  headers.set("x-content-type-options", "nosniff");
  return new Response(upstream.body, { status: upstream.status, headers });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const DELETE = forward;
