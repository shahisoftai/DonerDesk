import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session-server";
import { apiBaseUrl } from "@/lib/server/api-gateway";

export const dynamic = "force-dynamic";

/** A published export's bytes. The API refuses anything that is not this design's own export. */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string; exportId: string }> }) {
  const token = await getSessionToken();
  if (!token) return new Response("Unauthorized", { status: 401 });
  const { id, exportId } = await context.params;
  let upstream: Response;
  try {
    upstream = await fetch(`${apiBaseUrl()}/v1/infographics/${encodeURIComponent(id)}/exports/${encodeURIComponent(exportId)}/file`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    return new Response("Service unavailable", { status: 502 });
  }
  if (!upstream.ok || !upstream.body) return new Response("This export is unavailable.", { status: upstream.status === 404 ? 404 : 502 });
  return new Response(upstream.body, {
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "content-disposition": upstream.headers.get("content-disposition") ?? `attachment; filename="infographic-${exportId}"`,
      "cache-control": "private, no-store",
    },
  });
}
