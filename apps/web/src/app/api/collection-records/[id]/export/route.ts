import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session-server";
import { apiBaseUrl } from "@/lib/server/api-gateway";

export const dynamic = "force-dynamic";

const FORMATS = new Set(["PDF", "DOCX", "XLSX"]);

/** Downloads a completed assessment as PDF, Word or Excel, drawn on the server from the stored answers. */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const token = await getSessionToken();
  if (!token) return new Response("Unauthorized", { status: 401 });
  const { id } = await context.params;
  const format = (request.nextUrl.searchParams.get("format") ?? "PDF").toUpperCase();
  const language = request.nextUrl.searchParams.get("language");
  if (!FORMATS.has(format)) return new Response("Unknown format", { status: 400 });
  try {
    const query = new URLSearchParams({ format, ...(language && /^[a-z]{2,8}$/.test(language) ? { language } : {}) });
    const upstream = await fetch(`${apiBaseUrl()}/v1/collection-records/${encodeURIComponent(id)}/export?${query}`, { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!upstream.ok) return new Response(await upstream.text(), { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") ?? "text/plain" } });
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
