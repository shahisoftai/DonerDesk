import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session-server";
import { apiBaseUrl } from "@/lib/server/api-gateway";

export const dynamic = "force-dynamic";

/** Streams a donor template's original upload through the authenticated api. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ templateId: string }> }) {
  const token = await getSessionToken();
  if (!token) return new Response("Unauthorized", { status: 401 });
  const { templateId } = await params;

  let upstream: Response;
  try {
    upstream = await fetch(`${apiBaseUrl()}/v1/templates/${encodeURIComponent(templateId)}/original`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    return new Response("Service unavailable", { status: 502 });
  }
  if (!upstream.ok) return new Response("File unavailable", { status: upstream.status });

  return new Response(await upstream.arrayBuffer(), {
    status: 200,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "content-disposition": upstream.headers.get("content-disposition") ?? "attachment",
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
    },
  });
}
