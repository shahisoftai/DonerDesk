import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session-server";
import { apiBaseUrl } from "@/lib/server/api-gateway";

export const dynamic = "force-dynamic";

/** The framework as a Word or PDF file, fetched with the signed-in person's own session (Phase 52.2). */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const token = await getSessionToken();
  if (!token) return new Response("Unauthorized", { status: 401 });
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const lens = searchParams.get("lens") ?? "LOGFRAME";
  const format = searchParams.get("format") === "pdf" ? "pdf" : "docx";

  let upstream: Response;
  try {
    upstream = await fetch(`${apiBaseUrl()}/v1/projects/${encodeURIComponent(id)}/framework/export?lens=${encodeURIComponent(lens)}&format=${format}`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    return new Response("Service unavailable", { status: 502 });
  }
  if (!upstream.ok) return new Response("The file is unavailable", { status: upstream.status });

  return new Response(await upstream.arrayBuffer(), {
    status: 200,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "content-disposition": upstream.headers.get("content-disposition") ?? `attachment; filename="framework.${format}"`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
    },
  });
}
