import { NextRequest } from "next/server";
import { apiBaseUrl } from "@/lib/server/api-gateway";

export const dynamic = "force-dynamic";

/** The words that go with a shared file (title, description, expiry). */
export async function GET(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return Response.json({ title: "This link is not available" }, { status: 404 });
  try {
    const upstream = await fetch(`${apiBaseUrl()}/public/infographics/${encodeURIComponent(token)}/info`, { cache: "no-store" });
    return new Response(await upstream.text(), { status: upstream.status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow" } });
  } catch {
    return Response.json({ title: "Service unavailable" }, { status: 502 });
  }
}
