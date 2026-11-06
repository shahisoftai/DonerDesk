import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session-server";
import { apiBaseUrl } from "@/lib/server/api-gateway";

export const dynamic = "force-dynamic";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store" };

async function proxy(request: NextRequest, path: string, init?: { method?: string; body?: string }): Promise<Response> {
  const token = await getSessionToken();
  if (!token) return new Response("Unauthorized", { status: 401 });
  let upstream: Response;
  try {
    upstream = await fetch(`${apiBaseUrl()}${path}`, {
      method: init?.method ?? "GET",
      headers: { authorization: `Bearer ${token}`, ...(init?.body ? { "content-type": "application/json" } : {}) },
      body: init?.body,
      cache: "no-store",
    });
  } catch {
    return new Response("Service unavailable", { status: 502 });
  }
  const text = await upstream.text();
  return new Response(text, { status: upstream.status, headers: JSON_HEADERS });
}

/** A design's published exports: list them, or freeze a new one (PNG | PDF, with browser-resolved map pins). */

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return proxy(request, `/v1/infographics/${encodeURIComponent(id)}/exports`);
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.text();
  return proxy(request, `/v1/infographics/${encodeURIComponent(id)}/exports`, { method: "POST", body });
}
