import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session-server";
import { apiBaseUrl } from "@/lib/server/api-gateway";

export const dynamic = "force-dynamic";

/** Downloads a photo or document attached to a collected record, for the people who review records. */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const token = await getSessionToken();
  if (!token) return new Response("Unauthorized", { status: 401 });
  const { id } = await context.params;
  try {
    const upstream = await fetch(`${apiBaseUrl()}/v1/collection-files/${encodeURIComponent(id)}`, { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!upstream.ok) return new Response("File not found", { status: upstream.status });
    return new Response(await upstream.arrayBuffer(), {
      status: 200,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
        "content-disposition": upstream.headers.get("content-disposition") ?? "attachment",
        "x-content-type-options": "nosniff", "cache-control": "private, no-store",
      },
    });
  } catch {
    return new Response("Service unavailable", { status: 502 });
  }
}
