import { NextRequest } from "next/server";
import { apiBaseUrl } from "@/lib/server/api-gateway";

export const dynamic = "force-dynamic";

const TOKEN = /^[A-Za-z0-9_-]{20,100}$/;

/** Sends a photo or document from a public collection link on to the API (5 MB at most). The link is the credential; no cookie is forwarded. */
export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!TOKEN.test(token)) return Response.json({ title: "This link is not available" }, { status: 404 });
  if (Number(request.headers.get("content-length") ?? 0) > 6 * 1024 * 1024) return Response.json({ title: "That file is larger than 5 MB." }, { status: 413 });
  try {
    const upstream = await fetch(`${apiBaseUrl()}/public/collect/${encodeURIComponent(token)}/files`, {
      method: "POST", headers: { "content-type": request.headers.get("content-type") ?? "" }, body: await request.arrayBuffer(), cache: "no-store",
    });
    return new Response(await upstream.text(), { status: upstream.status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store" } });
  } catch {
    return Response.json({ title: "Service unavailable" }, { status: 502 });
  }
}
