import { NextRequest } from "next/server";
import { apiBaseUrl } from "@/lib/server/api-gateway";

export const dynamic = "force-dynamic";

const TOKEN = /^[A-Za-z0-9_-]{20,100}$/;
const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow" };

/** Sends a public collection-link answer on to the API. The link is the credential: there is no session and no cookie is forwarded. */
export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!TOKEN.test(token)) return Response.json({ title: "This link is not available" }, { status: 404 });
  const body = await request.text();
  if (body.length > 100_000) return Response.json({ title: "That is too much to send at once." }, { status: 413 });
  try {
    const upstream = await fetch(`${apiBaseUrl()}/public/collect/${encodeURIComponent(token)}`, { method: "POST", headers: { "content-type": "application/json" }, body, cache: "no-store" });
    return new Response(await upstream.text(), { status: upstream.status, headers });
  } catch {
    return Response.json({ title: "Service unavailable" }, { status: 502 });
  }
}
